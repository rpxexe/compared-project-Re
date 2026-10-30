// FilterState: the single, immutable source of truth for a property search.
//   { context, query: { search, city, locality, propertyType, developer, project }, values: { [filterId]: value } }
// `values` only holds filters that differ from their default, so two equal searches are always
// deep-equal and serialise to the same query string. Pure (no React / storage) and unit tested.
//
// Value shapes by filter type:
//   range         { min: number|null, max: number|null, unit?: string }   (unit only for unit ranges)
//   multi_select  [optionValue, ...]  (in option order)
//   single_select optionValue
//   toggle        true
import { getContext } from './filterConfig.js';

// Free-form search inputs carried alongside the filters. propertyType/developer are the free-text
// params older screens (Home shortcuts, search history) send; they stay so those links keep working.
// developer/project are also picked on the filter screen (Projects tab).
export const QUERY_KEYS = ['search', 'city', 'locality', 'propertyType', 'developer', 'project'];
const COUNTED_QUERY_KEYS = ['propertyType', 'developer', 'project'];
// Ids for query keys in filter-id positions (clear, chips) carry a prefix so they can never clash
// with a config filter id (there is a "propertyType" filter *and* a free-text propertyType).
export const queryId = (key) => `q:${key}`;
const queryKeyOf = (id) => (typeof id === 'string' && id.startsWith('q:') && QUERY_KEYS.includes(id.slice(2)) ? id.slice(2) : null);

// Onboarding intent (IntentScreen) -> default search context.
export const INTENT_CONTEXT = {
  buy: 'buy_residential',
  rent: 'rent_residential',
  'new-projects': 'new_projects',
  commercial: 'commercial',
  plots: 'plots',
};

const emptyQuery = () => Object.fromEntries(QUERY_KEYS.map((k) => [k, '']));
const filtersOf = (config, context) => getContext(config, context)?.filters || [];
const findFilter = (config, context, id) => filtersOf(config, context).find((f) => f.id === id);
const toNum = (v, allowZero = false) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) && (n > 0 || (allowZero && n === 0)) ? n : null;
};
// A range whose first step is 0 (floors: "Ground") treats 0 as a real bound.
const zeroOk = (filter) => (filter.steps || [])[0] === 0;

function freeze(state) {
  Object.values(state.values).forEach((v) => v && typeof v === 'object' && Object.freeze(v));
  Object.freeze(state.values);
  Object.freeze(state.query);
  return Object.freeze(state);
}

// Coerces a raw value into the canonical shape for `filter`, or undefined when it equals the default.
export function normalizeValue(filter, value) {
  switch (filter.type) {
    case 'range': {
      if (!value || typeof value !== 'object') return undefined;
      let min = toNum(value.min, zeroOk(filter));
      let max = toNum(value.max, zeroOk(filter));
      if (min == null && max == null) return undefined;
      if (min != null && max != null && min > max) [min, max] = [max, min];
      const out = { min, max };
      if (filter.unit) out.unit = filter.unit.options.some((o) => o.value === value.unit) ? value.unit : filter.unit.default;
      return out;
    }
    case 'multi_select': {
      const picked = new Set(Array.isArray(value) ? value : value == null ? [] : [value]);
      const out = filter.options.filter((o) => picked.has(o.value)).map((o) => o.value);
      return out.length ? out : undefined;
    }
    case 'single_select':
      return filter.options.some((o) => o.value === value) && value !== filter.default ? value : undefined;
    case 'toggle':
      return value === true || value === 'true' ? true : undefined;
    default:
      return undefined;
  }
}

export function createFilterState(config, context, { query = {}, values = {} } = {}) {
  const ctx = getContext(config, context);
  const q = emptyQuery();
  for (const k of QUERY_KEYS) if (typeof query[k] === 'string') q[k] = query[k].trim().slice(0, 80);
  const vals = {};
  for (const f of ctx?.filters || []) {
    const v = normalizeValue(f, values[f.id]);
    if (v !== undefined) vals[f.id] = v;
  }
  return freeze({ context: ctx?.id || '', query: q, values: vals });
}

export function setValue(state, config, id, value) {
  return createFilterState(config, state.context, { query: state.query, values: { ...state.values, [id]: value } });
}

export function setQuery(state, config, patch) {
  return createFilterState(config, state.context, { query: { ...state.query, ...patch }, values: state.values });
}

// Switching context keeps whatever still makes sense there (same filter id, still-valid values).
export function setContext(state, config, context) {
  return createFilterState(config, context, state);
}

export function clear(state, config, id) {
  const key = queryKeyOf(id);
  if (key) return setQuery(state, config, { [key]: '' });
  const { [id]: _removed, ...rest } = state.values;
  return createFilterState(config, state.context, { query: state.query, values: rest });
}

// Clears every filter. Location/search text and the sort order are part of *what* you searched,
// not a filter, so they stay.
export function clearAll(state, config) {
  const sortId = getContext(config, state.context)?.sort;
  const values = sortId && state.values[sortId] !== undefined ? { [sortId]: state.values[sortId] } : {};
  const query = { ...state.query };
  COUNTED_QUERY_KEYS.forEach((k) => { query[k] = ''; });
  return createFilterState(config, state.context, { query, values });
}

// The filter screen's "Clear all": filters *and* location/search text; only the sort order stays.
export function clearEverything(state, config) {
  const sortId = getContext(config, state.context)?.sort;
  const values = sortId && state.values[sortId] !== undefined ? { [sortId]: state.values[sortId] } : {};
  return createFilterState(config, state.context, { values });
}

// How many selections a sidebar category holds (its badge on the filter screen).
const PANEL_QUERY_KEYS = { location: ['city', 'locality'], project: ['project'], developer: ['developer'] };
export function categoryCount(state, category) {
  const fromQuery = (PANEL_QUERY_KEYS[category.panel] || []).filter((k) => state.query[k]).length;
  return fromQuery + category.filters.filter((id) => state.values[id] !== undefined).length;
}

// Empties one sidebar category (its "Clear" link), leaving every other selection as it was.
export function clearCategory(state, config, category) {
  const values = { ...state.values };
  category.filters.forEach((id) => { delete values[id]; });
  const query = { ...state.query };
  (PANEL_QUERY_KEYS[category.panel] || []).forEach((k) => { query[k] = ''; });
  return createFilterState(config, state.context, { query, values });
}

const isSort = (config, state, id) => findFilter(config, state.context, id)?.role === 'sort';

// Ids of active filters (sort excluded), plus legacy free-text filters, in config order.
export function activeFilterIds(state, config) {
  const ids = filtersOf(config, state.context).filter((f) => f.role !== 'sort' && state.values[f.id] !== undefined).map((f) => f.id);
  return [...ids, ...COUNTED_QUERY_KEYS.filter((k) => state.query[k]).map(queryId)];
}
export const activeFilterCount = (state, config) => activeFilterIds(state, config).length;

export function toQueryParams(state, config) {
  const out = { context: state.context };
  for (const k of QUERY_KEYS) if (state.query[k]) out[k] = state.query[k];
  for (const f of filtersOf(config, state.context)) {
    const v = state.values[f.id];
    if (v === undefined) continue;
    if (f.type === 'range') {
      if (v.min != null) out[f.queryKeys[0]] = String(v.min);
      if (v.max != null) out[f.queryKeys[1]] = String(v.max);
      if (f.unit && v.unit !== f.unit.default) out[f.unit.queryKey] = v.unit;
    } else if (f.type === 'multi_select') {
      const backend = f.options.filter((o) => v.includes(o.value)).flatMap((o) => o.values);
      out[f.queryKeys[0]] = [...new Set(backend)].join(',');
    } else if (f.type === 'single_select') {
      out[f.queryKeys[0]] = v;
    } else if (f.type === 'toggle') {
      out[f.queryKeys[0]] = 'true';
    }
  }
  return out;
}

const tokenKey = (s) => String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');
function parseMulti(filter, raw) {
  const tokens = String(raw ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return undefined;
  const picked = new Set();
  for (const t of tokens) {
    // Exact backend value or option value; then a case/space-insensitive match ("Under Construction").
    let hits = filter.options.filter((o) => o.value === t || o.values.includes(t));
    if (!hits.length) hits = filter.options.filter((o) => tokenKey(o.value) === tokenKey(t) || o.values.some((v) => tokenKey(v) === tokenKey(t)));
    // Older links send a single open bound ("4+") for count filters: pick every option >= N.
    const open = !hits.length && t.match(/^(\d+)\s*\+?$/);
    if (open && t.includes('+')) hits = filter.options.filter((o) => parseInt(o.value, 10) >= Number(open[1]));
    hits.forEach((o) => picked.add(o.value));
  }
  return [...picked];
}

// Inverse of toQueryParams. Also understands the params older screens send (see QUERY_KEYS),
// so deep links, search history and saved searches all land on the same state.
export function fromQueryParams(params = {}, config, fallbackContext) {
  const p = params || {};
  const context = getContext(config, p.context)?.id === p.context ? p.context : fallbackContext;
  const filters = filtersOf(config, context);
  const query = {};
  for (const k of QUERY_KEYS) if (p[k] != null && typeof p[k] !== 'object') query[k] = String(p[k]);
  const values = {};
  for (const f of filters) {
    const [k0, k1] = f.queryKeys;
    if (f.type === 'range') values[f.id] = { min: p[k0], max: p[k1], unit: f.unit ? p[f.unit.queryKey] : undefined };
    else if (f.type === 'multi_select') values[f.id] = parseMulti(f, p[k0]);
    else if (f.type === 'single_select') values[f.id] = p[k0] == null ? undefined : String(p[k0]);
    else if (f.type === 'toggle') values[f.id] = p[k0] === true || p[k0] === 'true';
  }
  // Free-text property type from older screens: map onto a type option when an alias matches.
  if (query.propertyType) {
    const typed = query.propertyType.trim().toLowerCase();
    for (const f of filters) {
      if (f.type !== 'multi_select') continue;
      const opt = f.options.find((o) => o.aliases.some((a) => a.toLowerCase() === typed) || o.label.toLowerCase() === typed);
      if (opt) {
        values[f.id] = [...(values[f.id] || []), opt.value];
        query.propertyType = '';
        break;
      }
    }
  }
  return createFilterState(config, context, { query, values });
}

// ----- Labels -------------------------------------------------------------------------------
const trimNum = (n) => String(+n.toFixed(2));
export function shortInr(n) {
  if (n >= 10000000) return `${trimNum(n / 10000000)}Cr`;
  if (n >= 100000) return `${trimNum(n / 100000)}L`;
  if (n >= 1000) return `${trimNum(n / 1000)}K`;
  return String(n);
}
export const unitLabel = (filter, unit) => filter.unit?.options.find((o) => o.value === unit)?.label || '';

export function formatStep(filter, n, unit) {
  if (filter.format === 'floor') return n === 0 ? 'Ground' : String(n);
  if (filter.format === 'area') return `${Number(n).toLocaleString('en-IN')} ${unitLabel(filter, unit)}`.trim();
  return `₹${shortInr(n)}`;
}

function rangeLabel(filter, { min, max, unit }) {
  if (filter.format === 'floor') {
    const f = (n) => formatStep(filter, n);
    if (min != null && max != null) return `Floor ${f(min)}–${f(max)}`;
    return min != null ? `Floor ${f(min)}+` : `Up to floor ${f(max)}`;
  }
  if (filter.format === 'area') {
    const u = unitLabel(filter, unit);
    const f = (n) => Number(n).toLocaleString('en-IN');
    if (min != null && max != null) return `${f(min)}–${f(max)} ${u}`;
    return min != null ? `${f(min)}+ ${u}` : `Up to ${f(max)} ${u}`;
  }
  if (min != null && max != null) return `₹${shortInr(min)}–${shortInr(max)}`;
  return min != null ? `₹${shortInr(min)}+` : `Under ₹${shortInr(max)}`;
}

// Text for a chip: the selected value(s), or null when the filter is not active.
export function chipLabel(state, config, id) {
  const key = queryKeyOf(id);
  if (key) return state.query[key] || null;
  const f = findFilter(config, state.context, id);
  const v = state.values[id];
  if (!f || v === undefined) return null;
  if (f.type === 'range') return rangeLabel(f, v);
  if (f.type === 'toggle') return f.label;
  const labels = f.options.filter((o) => (Array.isArray(v) ? v.includes(o.value) : o.value === v)).map((o) => o.label);
  if (f.unitLabel) return `${labels.join(', ')} ${f.unitLabel}`;
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0];
}

// One entry per active filter with the state it would leave behind if removed. The results
// screen counts each to suggest which filter to drop when nothing matches.
export function withoutEach(state, config) {
  return activeFilterIds(state, config)
    .filter((id) => !isSort(config, state, id))
    .map((id) => ({
      id,
      label: chipLabel(state, config, id),
      state: clear(state, config, id),
    }));
}

export const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b);
