import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFilterConfig, contextIds, getContext } from '../src/utils/filterConfig.js';
import {
  createFilterState, setValue, setQuery, setContext, clear, clearAll, activeFilterCount, activeFilterIds,
  toQueryParams, fromQueryParams, chipLabel, withoutEach, shortInr, sameState, INTENT_CONTEXT,
} from '../src/utils/filterState.js';

const config = parseFilterConfig(JSON.parse(readFileSync(new URL('../src/config/filters.json', import.meta.url), 'utf8')));
const BUY = 'buy_residential';
const rich = () => createFilterState(config, BUY, {
  query: { search: 'Skyline', city: 'Mumbai', locality: 'Andheri West' },
  values: {
    budget: { min: 5000000, max: 10000000 },
    propertyType: ['house_villa', 'apartment'],
    bhk: ['3', '2'],
    possession: ['ready'],
    area: { min: 50, max: 150, unit: 'sqm' },
    amenities: ['gym', 'pool'],
    rera: true,
    postedSince: '30d',
    sort: 'price_asc',
  },
});

test('state is immutable and only stores non-default values', () => {
  const s = rich();
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.values) && Object.isFrozen(s.values.bhk) && Object.isFrozen(s.query));
  assert.throws(() => { s.values.bhk.push('4'); }, TypeError);
  const d = createFilterState(config, BUY, { values: { bhk: [], rera: false, sort: 'relevance', postedSince: '', budget: {} } });
  assert.deepEqual(d.values, {}, 'defaults are not stored');
  const s2 = setValue(s, config, 'bhk', ['4']);
  assert.notEqual(s2, s);
  assert.deepEqual(s.values.bhk, ['2', '3'], 'original untouched; values kept in option order');
  assert.deepEqual(s2.values.bhk, ['4']);
});

test('invalid values are dropped; ranges are fixed up', () => {
  const s = createFilterState(config, BUY, { values: { bhk: ['9', '2'], furnishing: 'semi', sort: 'bogus', nope: 1, budget: { min: 9000000, max: 2000000 }, area: { min: 'abc', max: -5 } } });
  assert.deepEqual(s.values.bhk, ['2']);
  assert.deepEqual(s.values.furnishing, ['semi'], 'a single value is accepted for multi-select');
  assert.equal(s.values.sort, undefined);
  assert.equal(s.values.nope, undefined);
  assert.deepEqual(s.values.budget, { min: 2000000, max: 9000000 }, 'min > max is swapped');
  assert.equal(s.values.area, undefined);
  assert.equal(createFilterState(config, BUY, { values: { area: { min: 100 } } }).values.area.unit, 'sqft', 'unit defaults');
});

test('toQueryParams produces the backend contract', () => {
  assert.deepEqual(toQueryParams(rich(), config), {
    context: BUY,
    search: 'Skyline',
    city: 'Mumbai',
    locality: 'Andheri West',
    minPrice: '5000000',
    maxPrice: '10000000',
    propertyTypes: 'apartment,independent_house,villa',
    bhk: '2,3',
    possession: 'ready',
    minArea: '50',
    maxArea: '150',
    areaUnit: 'sqm',
    amenities: 'gym,pool',
    rera: 'true',
    postedSince: '30d',
    sort: 'price_asc',
  });
  assert.deepEqual(toQueryParams(createFilterState(config, BUY), config), { context: BUY }, 'defaults are omitted');
  const sqft = createFilterState(config, BUY, { values: { area: { max: 1000, unit: 'sqft' } } });
  assert.equal(toQueryParams(sqft, config).areaUnit, undefined, 'default unit omitted');
});

test('round trip: fromQueryParams(toQueryParams(s)) === s, for every context', () => {
  const states = [rich(), createFilterState(config, BUY)];
  for (const ctx of contextIds(config)) {
    // Every option of every filter at once, plus every range bound, per context.
    const values = {};
    for (const f of getContext(config, ctx).filters) {
      if (f.type === 'multi_select') values[f.id] = f.options.map((o) => o.value);
      if (f.type === 'single_select') values[f.id] = f.options[f.options.length - 1].value;
      if (f.type === 'toggle') values[f.id] = true;
      if (f.type === 'range') {
        const steps = f.unit ? f.stepsByUnit[f.unit.options[1].value] : f.steps;
        values[f.id] = { min: steps[1], max: steps[3], unit: f.unit?.options[1].value };
      }
    }
    states.push(createFilterState(config, ctx, { query: { city: 'Pune' }, values }));
    states.push(createFilterState(config, ctx, { values: { budget: { max: 2000000 } } }));
  }
  for (const s of states) {
    const params = toQueryParams(s, config);
    const back = fromQueryParams(params, config, 'plots');
    assert.deepEqual(back, s, JSON.stringify(params));
    // Also through an actual URL query string (deep links, saved searches).
    const viaUrl = Object.fromEntries(new URLSearchParams(new URLSearchParams(params).toString()));
    assert.deepEqual(fromQueryParams(viaUrl, config, 'plots'), s);
  }
});

test('fromQueryParams understands older screens and deep links', () => {
  // Home: "Recent search" / shortcuts
  const home = fromQueryParams({ city: 'Mumbai', propertyType: 'Flats/Apartments', bhk: '4+', featured: true, sort: '' }, config, BUY);
  assert.equal(home.context, BUY, 'falls back to the given context');
  assert.deepEqual(home.values.propertyType, ['apartment'], 'free-text type mapped via aliases');
  assert.equal(home.query.propertyType, '');
  assert.deepEqual(home.values.bhk, ['4', '5+'], '"4+" selects 4 and 5+');
  assert.equal(home.values.featured, true);
  assert.equal(home.values.sort, undefined);
  const unknownType = fromQueryParams({ propertyType: 'Farm House' }, config, BUY);
  assert.equal(unknownType.query.propertyType, 'Farm House', 'unmapped free text is kept, not lost');
  assert.equal(activeFilterCount(unknownType, config), 1);
  const labels = fromQueryParams({ possession: 'Under Construction,Ready', furnishing: 'Semi,Partly', context: 'nope' }, config, BUY);
  assert.deepEqual(labels.values.possession, ['under_construction', 'ready'], 'labels match case/space-insensitively');
  assert.deepEqual(labels.values.furnishing, ['semi'], 'unknown tokens are dropped');
  assert.deepEqual(fromQueryParams({ propertyTypes: 'villa' }, config, BUY).values.propertyType, ['house_villa'], 'a backend value selects its option');
  assert.deepEqual(fromQueryParams({ context: 'rent_residential', propertyTypes: 'pg' }, config, BUY).values.propertyType, ['pg']);
  assert.deepEqual(fromQueryParams({ 'bhk[$ne]': 'x', bhk: { $ne: 1 }, city: { evil: 1 } }, config, BUY).values, {}, 'objects ignored');
  assert.deepEqual(fromQueryParams(null, config, BUY), createFilterState(config, BUY));
});

test('active count, clear and clearAll', () => {
  const s = rich();
  assert.equal(activeFilterCount(s, config), 8, 'sort and location are not filters');
  assert.deepEqual(activeFilterIds(s, config), ['budget', 'propertyType', 'bhk', 'possession', 'area', 'amenities', 'rera', 'postedSince']);
  const noBhk = clear(s, config, 'bhk');
  assert.equal(noBhk.values.bhk, undefined);
  assert.equal(activeFilterCount(noBhk, config), 7);
  assert.equal(clear(s, config, 'sort').values.sort, undefined);
  assert.equal(clear(s, config, 'q:city').query.city, '');
  assert.equal(clear(s, config, 'city').query.city, 'Mumbai', 'bare query keys are not filter ids');
  const both = fromQueryParams({ propertyType: 'Farm House', propertyTypes: 'villa' }, config, BUY);
  assert.deepEqual(activeFilterIds(both, config), ['propertyType', 'q:propertyType'], 'type filter and free text are distinct');
  assert.equal(chipLabel(both, config, 'q:propertyType'), 'Farm House');
  assert.equal(chipLabel(both, config, 'propertyType'), 'House / Villa');
  assert.deepEqual(clear(both, config, 'propertyType').query.propertyType, 'Farm House');
  assert.ok(sameState(clear(s, config, 'not-a-filter'), s));
  const none = clearAll(s, config);
  assert.equal(activeFilterCount(none, config), 0);
  assert.equal(none.values.sort, 'price_asc', 'sort survives clear all');
  assert.equal(none.query.city, 'Mumbai', 'location survives clear all');
  assert.equal(none.query.search, 'Skyline');
  const legacy = fromQueryParams({ propertyType: 'Farm House', developer: 'Alpha' }, config, BUY);
  assert.equal(activeFilterCount(clearAll(legacy, config), config), 0, 'legacy free-text filters are cleared too');
});

test('switching context keeps compatible values only', () => {
  const s = setContext(rich(), config, 'plots');
  assert.equal(s.context, 'plots');
  assert.deepEqual(Object.keys(s.values).sort(), ['area', 'budget', 'postedSince', 'rera', 'sort']);
  assert.equal(s.query.city, 'Mumbai');
  const rent = setContext(setValue(rich(), config, 'propertyType', ['penthouse']), config, 'rent_residential');
  assert.equal(rent.values.propertyType, undefined, 'penthouse is not a rent option');
  assert.equal(setQuery(rich(), config, { city: '  Pune ' }).query.city, 'Pune');
});

test('chip labels', () => {
  const s = rich();
  assert.equal(chipLabel(s, config, 'budget'), '₹50L–1Cr');
  assert.equal(chipLabel(s, config, 'bhk'), '2, 3 BHK');
  assert.equal(chipLabel(s, config, 'propertyType'), 'Flat +1');
  assert.equal(chipLabel(s, config, 'area'), '50–150 Sq.m');
  assert.equal(chipLabel(s, config, 'rera'), 'RERA registered');
  assert.equal(chipLabel(s, config, 'postedSince'), 'Last month');
  assert.equal(chipLabel(s, config, 'furnishing'), null, 'inactive');
  const one = (v) => chipLabel(createFilterState(config, BUY, { values: { budget: v } }), config, 'budget');
  assert.equal(one({ max: 5000000 }), 'Under ₹50L');
  assert.equal(one({ min: 15000000 }), '₹1.5Cr+');
  const rent = createFilterState(config, 'rent_residential', { values: { budget: { min: 15000, max: 25000 } } });
  assert.equal(chipLabel(rent, config, 'budget'), '₹15K–25K');
  assert.equal(shortInr(7500000), '75L');
  assert.equal(shortInr(999), '999');
});

test('floor ranges treat 0 as the ground floor', () => {
  const s = createFilterState(config, BUY, { values: { floor: { min: 0, max: 5 } } });
  assert.deepEqual(s.values.floor, { min: 0, max: 5 });
  assert.equal(toQueryParams(s, config).minFloor, '0');
  assert.deepEqual(fromQueryParams(toQueryParams(s, config), config, BUY), s);
  assert.equal(chipLabel(s, config, 'floor'), 'Floor Ground–5');
  assert.equal(createFilterState(config, BUY, { values: { budget: { min: 0 } } }).values.budget, undefined, '0 is not a budget');
});

test('PG is a property type inside Rent', () => {
  const s = fromQueryParams({ context: 'rent_residential', propertyTypes: 'pg', maxPrice: '10000' }, config, BUY);
  assert.deepEqual(s.values.propertyType, ['pg']);
  assert.equal(chipLabel(s, config, 'propertyType'), 'PG / Co-living');
  assert.equal(chipLabel(s, config, 'budget'), 'Under ₹10K');
  assert.equal(fromQueryParams({ context: 'pg' }, config, BUY).context, BUY, 'no separate PG context');
});

test('withoutEach lists one removal per active filter', () => {
  const s = rich();
  const list = withoutEach(s, config);
  assert.equal(list.length, 8);
  const bhk = list.find((x) => x.id === 'bhk');
  assert.equal(bhk.label, '2, 3 BHK');
  assert.equal(bhk.state.values.bhk, undefined);
  assert.equal(activeFilterCount(bhk.state, config), 7);
  assert.deepEqual(withoutEach(createFilterState(config, BUY), config), []);
});

test('every onboarding intent maps to a real context', () => {
  for (const ctx of Object.values(INTENT_CONTEXT)) assert.ok(getContext(config, ctx)?.id === ctx, ctx);
});

test('filter-screen helpers: category counts, clearing a category, clearing everything', async () => {
  const { categoryCount, clearCategory, clearEverything } = await import('../src/utils/filterState.js');
  const projects = getContext(config, 'new_projects').sidebar;
  const cat = (id) => projects.find((c) => c.id === id);
  let s = createFilterState(config, 'new_projects', {
    query: { search: 'sea view', city: 'Mumbai', developer: 'Bay Developers', project: 'Bay View' },
    values: { bhk: ['2', '3'], possession: ['upcoming'], sort: 'newest' },
  });
  assert.equal(categoryCount(s, cat('location')), 1);
  assert.equal(categoryCount(s, cat('developer')), 1);
  assert.equal(categoryCount(s, cat('bhk')), 1);
  assert.equal(toQueryParams(s, config).project, 'Bay View', 'project is sent to the API');
  assert.ok(activeFilterIds(s, config).includes('q:project'));

  s = clearCategory(s, config, cat('developer'));
  assert.equal(s.query.developer, '');
  assert.deepEqual(s.values.bhk, ['2', '3'], 'other categories untouched');

  s = clearEverything(s, config);
  assert.deepEqual(s.values, { sort: 'newest' }, 'sort survives');
  assert.deepEqual(Object.values(s.query).filter(Boolean), [], 'location and search are cleared too');
});
