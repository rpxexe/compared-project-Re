import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFilterConfig, parseEntry, getContext, getFilter, contextIds } from '../src/utils/filterConfig.js';

const RAW = JSON.parse(readFileSync(new URL('../src/config/filters.json', import.meta.url), 'utf8'));

test('the bundled config parses with no errors', () => {
  const c = parseFilterConfig(RAW);
  assert.deepEqual(c.errors, []);
  assert.deepEqual(contextIds(c), ['buy_residential', 'rent_residential', 'new_projects', 'commercial', 'plots']);
  for (const id of contextIds(c)) {
    const ctx = getContext(c, id);
    assert.ok(ctx.quick.length >= 3, `${id} has quick chips`);
    assert.equal(ctx.sort, 'sort', `${id} has a sort`);
  }
});

test('contexts resolve shared definitions, bases and overrides', () => {
  const c = parseFilterConfig(RAW);
  const buy = getFilter(c, 'buy_residential', 'budget');
  const rent = getFilter(c, 'rent_residential', 'budget');
  assert.deepEqual(buy.queryKeys, ['minPrice', 'maxPrice']);
  assert.equal(rent.label, 'Monthly rent', 'rent budget is based on rentBudget');
  assert.ok(rent.steps[0] < buy.steps[0], 'rent steps are monthly amounts');
  const pg = getFilter(c, 'rent_residential', 'propertyType').options.find((o) => o.value === 'pg');
  assert.ok(pg, 'PG lives inside rent');
  const houseVilla = getFilter(c, 'buy_residential', 'propertyType').options.find((o) => o.value === 'house_villa');
  assert.deepEqual(houseVilla.values, ['independent_house', 'villa'], 'one option maps to several backend values');
  assert.equal(getFilter(c, 'plots', 'area').unit.default, 'sqyd', 'plots override the area unit');
  assert.equal(getFilter(c, 'buy_residential', 'area').unit.default, 'sqft');
  assert.equal(getFilter(c, 'commercial', 'deal').default, 'sale', 'inline context-only filter');
  assert.equal(getFilter(c, 'buy_residential', 'verified').hidden, true);
  assert.ok(!getContext(c, 'buy_residential').quick.includes('verified'), 'hidden filters never become chips');
});

test('display and section hints drive the layout', () => {
  const c = parseFilterConfig(RAW);
  assert.equal(getFilter(c, 'buy_residential', 'propertyType').display, 'tiles');
  assert.equal(getFilter(c, 'buy_residential', 'propertyType').options[0].icon, 'business-outline');
  assert.equal(getFilter(c, 'buy_residential', 'bhk').display, 'pills', 'default display');
  assert.equal(getFilter(c, 'buy_residential', 'amenities').display, 'checkbox');
  assert.equal(getFilter(c, 'buy_residential', 'amenities').collapsedCount, 6);
  assert.equal(getFilter(c, 'commercial', 'deal').display, 'segmented');
  assert.equal(getFilter(c, 'buy_residential', 'area').section, 'advanced');
  assert.equal(getFilter(c, 'commercial', 'area').section, 'main', 'context override');
  assert.equal(getFilter(c, 'buy_residential', 'floor').steps[0], 0, 'ground floor step');
  assert.equal(getContext(c, 'rent_residential').icon, 'home-outline');
  const bad = parseFilterConfig({ contexts: { a: { filters: [
    { id: 'x', label: 'X', type: 'toggle', queryKey: 'x', display: 'tiles' },
    { id: 'y', label: 'Y', type: 'toggle', queryKey: 'y', section: 'sidebar' },
    { id: 'z', label: 'Z', type: 'toggle', queryKey: 'z' },
  ] } } });
  assert.deepEqual(getContext(bad, 'a').filters.map((f) => f.id), ['z']);
  assert.match(bad.errors.join(' | '), /display "tiles" is not valid for toggle/);
  assert.match(bad.errors.join(' | '), /unknown section "sidebar"/);
});

test('parsed config is deeply frozen', () => {
  const c = parseFilterConfig(RAW);
  assert.throws(() => { c.contexts.buy_residential.filters[0].label = 'x'; }, TypeError);
  assert.throws(() => { c.contexts.buy_residential.filters.push({}); }, TypeError);
});

test('invalid entries are dropped with a reason, valid ones survive', () => {
  const c = parseFilterConfig({
    definitions: { ok: { label: 'OK', type: 'toggle', queryKey: 'ok' } },
    contexts: {
      a: {
        filters: [
          'ok',
          'missing',
          { id: 'badType', label: 'X', type: 'slider', queryKey: 'x' },
          { id: 'noOpts', label: 'X', type: 'multi_select', queryKey: 'y', options: [] },
          { id: 'dupOpt', label: 'X', type: 'multi_select', queryKey: 'z', options: [{ value: 'a', label: 'A' }, { value: 'a', label: 'A2' }] },
          { id: 'badRange', label: 'X', type: 'range', queryKeys: ['lo'], steps: [1, 2] },
          { id: 'unsorted', label: 'X', type: 'range', queryKeys: ['lo', 'hi'], steps: [3, 2] },
          { id: 'emptyMulti', label: 'X', type: 'multi_select', queryKey: 'm', options: [{ value: '', label: 'Any' }] },
          { id: 'badDefault', label: 'X', type: 'single_select', queryKey: 's', default: 'nope', options: [{ value: 'a', label: 'A' }] },
          { id: 'clash', label: 'Clash', type: 'toggle', queryKey: 'ok' },
          { id: 'reserved', label: 'R', type: 'toggle', queryKey: 'context' },
          { id: 'ok', label: 'Again', type: 'toggle', queryKey: 'other' },
        ],
      },
      empty: { filters: ['missing'] },
    },
  });
  assert.deepEqual(getContext(c, 'a').filters.map((f) => f.id), ['ok']);
  assert.equal(c.contexts.empty, undefined, 'a context with nothing valid is dropped');
  const reasons = c.errors.join('\n');
  for (const s of ['a.missing: unknown filter', 'unknown type "slider"', 'needs at least one option', 'duplicate option "a"', 'two distinct queryKeys', 'option values cannot be empty', 'ascending', 'default "nope"', 'query key "ok" is already used', 'query key "context"', 'a.ok: duplicate id', 'empty: no valid filters']) {
    assert.ok(reasons.includes(s), `reports: ${s}\n${reasons}`);
  }
});

test('garbage input never throws', () => {
  for (const raw of [null, undefined, 42, 'x', [], { contexts: null }, { contexts: { a: null } }, { contexts: { a: { filters: [null, 7, {}] } } }]) {
    const c = parseFilterConfig(raw);
    assert.deepEqual(c.contexts, {});
    assert.equal(getContext(c, 'a'), null);
  }
});

test('parseEntry normalises defaults per type', () => {
  assert.deepEqual(parseEntry('t', { label: 'T', type: 'multi_select', queryKey: 'q', options: [{ value: 'a', label: 'A' }] }).default, []);
  assert.equal(parseEntry('t', { label: 'T', type: 'toggle', queryKey: 'q' }).default, false);
  assert.equal(parseEntry('t', { label: 'T', type: 'single_select', queryKey: 'q', options: [{ value: 'a', label: 'A' }] }).default, '');
  assert.equal(parseEntry('t', { label: 'T', type: 'range', queryKeys: ['a', 'b'], steps: [1] }).default, null);
  assert.throws(() => parseEntry('t', { label: 'T', type: 'range', queryKeys: ['a', 'b'], unit: { queryKey: 'u', options: [{ value: 'x', label: 'X' }] } }), /stepsByUnit\.x/);
});

test('sidebars follow the config, and "more" keeps every other filter reachable', () => {
  const c = parseFilterConfig(RAW);
  const ids = (ctx) => getContext(c, ctx).sidebar.map((s) => s.id);
  assert.deepEqual(ids('buy_residential'), ['location', 'budget', 'propertyType', 'bhk', 'area', 'furnishing', 'status', 'possession', 'amenities', 'more']);
  assert.deepEqual(ids('rent_residential'), ['location', 'budget', 'propertyType', 'bhk', 'area', 'furnishing', 'availableBy', 'amenities', 'more']);
  assert.deepEqual(ids('new_projects'), ['location', 'project', 'developer', 'budget', 'propertyType', 'bhk', 'status', 'amenities', 'more']);
  for (const id of contextIds(c)) {
    const ctx = getContext(c, id);
    const listed = ctx.sidebar.flatMap((s) => s.filters);
    const shown = ctx.filters.filter((f) => !f.hidden && f.role !== 'sort').map((f) => f.id);
    assert.deepEqual([...listed].sort(), [...shown].sort(), `${id}: every shown filter is in exactly one category`);
    assert.equal(ctx.sidebar[0].panel, 'location', `${id} starts with location`);
  }
});

test('bad sidebar entries are dropped and reported', () => {
  const c = parseFilterConfig({
    definitions: { x: { label: 'X', type: 'toggle', queryKey: 'x' } },
    contexts: { a: { label: 'A', filters: ['x'], sidebar: [
      { id: 'one', label: 'One', filters: ['x', 'nope'] },
      { id: 'two', label: 'Two', panel: 'weird' },
      { id: 'one', label: 'Again', filters: ['x'] },
      { id: 'more', label: 'More', panel: 'more' },
    ] } },
  });
  assert.deepEqual(getContext(c, 'a').sidebar.map((s) => [s.id, s.filters]), [['one', ['x']]], 'empty "more" is dropped');
  assert.equal(c.errors.length, 3);
});
