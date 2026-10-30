// Parses the filter config (src/config/filters.json today; the same shape can later come from
// the API). Pure: no React, no network, so it is unit tested under Node.
//
// Config shape:
//   definitions: { [id]: entry }                 shared filter definitions
//   contexts:    { [context]: { label, filters: [id | { id, base?, ...overrides }], sidebar? } }
//   sidebar:     [{ id, label, short?, icon?, panel?: location|project|developer|more, filters?: [filterId] }]
//                `short` is the one-line sidebar label (defaults to `label`).
//                the filter screen's categories; a context without one gets one per filter.
// Entry: { label, type: range|single_select|multi_select|toggle, queryKey | queryKeys,
//          options?: [{ value, label, values?, aliases?, icon? }], default?, quick?, hidden?, role?,
//          display?: how it is drawn (see DISPLAYS), section?: main|advanced, collapsedCount? }
// Invalid entries are dropped (and reported in `errors`) so a bad remote config can't crash the app.

export const FILTER_TYPES = ['range', 'single_select', 'multi_select', 'toggle'];
// Allowed renderings per type; the first is the default.
export const DISPLAYS = {
  range: ['dropdown'],
  multi_select: ['pills', 'tiles', 'checkbox'],
  single_select: ['pills', 'segmented'],
  toggle: ['switch'],
};
export const SECTIONS = ['main', 'advanced'];

const isStr = (v) => typeof v === 'string';
const isNonEmpty = (v) => isStr(v) && v.trim().length > 0;
// 0 is allowed only as a first step (e.g. "Ground" floor).
const isAscending = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((n, i) => Number.isFinite(n) && n >= 0 && (i === 0 || n > arr[i - 1]));

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

// `allowEmpty`: single-selects may offer an explicit "no filter" option with value "" (e.g. "Any time").
function parseOptions(raw, { allowEmpty = false } = {}) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('needs at least one option');
  const seen = new Set();
  return raw.map((o) => {
    if (!o || !isStr(o.value) || !isNonEmpty(o.label)) throw new Error('every option needs a string value and a label');
    if (o.value === '' && !allowEmpty) throw new Error('option values cannot be empty');
    if (o.value === '') return { value: '', label: o.label, values: [], aliases: [], icon: null };
    if (seen.has(o.value)) throw new Error(`duplicate option "${o.value}"`);
    seen.add(o.value);
    const values = o.values === undefined ? [o.value] : o.values;
    if (!Array.isArray(values) || !values.length || !values.every(isNonEmpty)) throw new Error(`option "${o.value}" has invalid values`);
    return { value: o.value, label: o.label, values: [...values], aliases: Array.isArray(o.aliases) ? o.aliases.filter(isStr) : [], icon: isStr(o.icon) ? o.icon : null };
  });
}

function parseUnit(raw) {
  if (!raw) return null;
  if (!isNonEmpty(raw.queryKey)) throw new Error('unit needs a queryKey');
  const options = parseOptions(raw.options);
  const def = raw.default ?? options[0].value;
  if (!options.some((o) => o.value === def)) throw new Error('unit default must be one of its options');
  return { queryKey: raw.queryKey, default: def, options };
}

// Turns one resolved raw entry into the normalised entry, or throws with the reason.
export function parseEntry(id, raw) {
  if (!isNonEmpty(id)) throw new Error('missing id');
  if (!raw || typeof raw !== 'object') throw new Error('unknown filter');
  const { type } = raw;
  if (!FILTER_TYPES.includes(type)) throw new Error(`unknown type "${type}"`);
  if (!isNonEmpty(raw.label)) throw new Error('missing label');
  const display = raw.display ?? DISPLAYS[type][0];
  if (!DISPLAYS[type].includes(display)) throw new Error(`display "${display}" is not valid for ${type}`);
  const section = raw.section ?? 'main';
  if (!SECTIONS.includes(section)) throw new Error(`unknown section "${section}"`);
  const entry = {
    display,
    section,
    collapsedCount: Number.isInteger(raw.collapsedCount) && raw.collapsedCount > 0 ? raw.collapsedCount : null,
    id,
    label: raw.label,
    type,
    quick: raw.quick === true && raw.hidden !== true,
    hidden: raw.hidden === true,
    role: isStr(raw.role) ? raw.role : null,
  };

  if (type === 'range') {
    const keys = raw.queryKeys;
    if (!Array.isArray(keys) || keys.length !== 2 || !keys.every(isNonEmpty) || keys[0] === keys[1]) throw new Error('range needs two distinct queryKeys');
    entry.queryKeys = [...keys];
    entry.format = ['area', 'floor'].includes(raw.format) ? raw.format : 'inr';
    entry.unit = parseUnit(raw.unit);
    if (entry.unit) {
      const byUnit = raw.stepsByUnit || {};
      entry.stepsByUnit = {};
      for (const o of entry.unit.options) {
        if (!isAscending(byUnit[o.value])) throw new Error(`stepsByUnit.${o.value} must be ascending positive numbers`);
        entry.stepsByUnit[o.value] = [...byUnit[o.value]];
      }
    } else {
      if (!isAscending(raw.steps)) throw new Error('steps must be ascending positive numbers');
      entry.steps = [...raw.steps];
    }
    entry.default = null;
    return entry;
  }

  if (!isNonEmpty(raw.queryKey)) throw new Error('needs a queryKey');
  entry.queryKeys = [raw.queryKey];

  if (type === 'toggle') {
    entry.default = false;
    return entry;
  }

  entry.options = parseOptions(raw.options, { allowEmpty: type === 'single_select' });
  entry.unitLabel = isStr(raw.unitLabel) ? raw.unitLabel : '';
  if (type === 'multi_select') {
    entry.default = [];
  } else {
    const def = raw.default ?? '';
    if (def !== '' && !entry.options.some((o) => o.value === def)) throw new Error(`default "${def}" is not an option`);
    entry.default = def;
  }
  return entry;
}

export const PANELS = ['location', 'project', 'developer', 'more'];
const shown = (f) => !f.hidden && f.role !== 'sort';

// Sidebar categories for the filter screen. Unknown filter ids are dropped (and reported); a
// category left with nothing to show is dropped. "more" collects every shown filter no other
// category lists, so a filter added to the context is never unreachable.
function parseSidebar(ctxId, raw, filters, errors) {
  const byId = new Map(filters.filter(shown).map((f) => [f.id, f]));
  if (!Array.isArray(raw)) {
    return [
      { id: 'location', label: 'City / Location', short: 'Location', icon: 'location-outline', panel: 'location', filters: [] },
      ...[...byId.values()].map((f) => ({ id: f.id, label: f.label, short: f.label, icon: null, panel: null, filters: [f.id] })),
    ];
  }
  const out = [];
  const seen = new Set();
  for (const c of raw) {
    const where = `${ctxId}.sidebar.${c?.id || '?'}`;
    if (!c || !isNonEmpty(c.id) || !isNonEmpty(c.label)) { errors.push(`${where}: needs an id and a label`); continue; }
    if (seen.has(c.id)) { errors.push(`${where}: duplicate id`); continue; }
    const panel = c.panel ?? null;
    if (panel !== null && !PANELS.includes(panel)) { errors.push(`${where}: unknown panel "${panel}"`); continue; }
    const ids = (Array.isArray(c.filters) ? c.filters : []).filter((id) => {
      if (byId.has(id)) return true;
      errors.push(`${where}: unknown filter "${id}"`);
      return false;
    });
    if (!panel && !ids.length) continue;
    seen.add(c.id);
    out.push({ id: c.id, label: c.label, short: isNonEmpty(c.short) ? c.short : c.label, icon: isStr(c.icon) ? c.icon : null, panel, filters: ids });
  }
  const listed = new Set(out.flatMap((c) => c.filters));
  const more = out.find((c) => c.panel === 'more');
  if (more) {
    more.filters = [...byId.keys()].filter((id) => !listed.has(id));
    if (!more.filters.length) out.splice(out.indexOf(more), 1);
  }
  return out;
}

function resolve(ref, definitions) {
  if (isStr(ref)) return { id: ref, raw: definitions[ref] };
  if (!ref || typeof ref !== 'object') return { id: '', raw: null };
  const { id, base, ...overrides } = ref;
  const from = definitions[base ?? id];
  if (base && !from) return { id, raw: null };
  return { id, raw: { ...(from || {}), ...overrides } };
}

export function parseFilterConfig(raw) {
  const errors = [];
  const definitions = raw && typeof raw.definitions === 'object' && raw.definitions ? raw.definitions : {};
  const contexts = {};
  const rawContexts = raw && typeof raw.contexts === 'object' && raw.contexts ? raw.contexts : {};

  for (const [ctxId, ctx] of Object.entries(rawContexts)) {
    const filters = [];
    const ids = new Set();
    const keys = new Set();
    for (const ref of Array.isArray(ctx?.filters) ? ctx.filters : []) {
      const { id, raw: entryRaw } = resolve(ref, definitions);
      try {
        const entry = parseEntry(id, entryRaw);
        if (ids.has(entry.id)) throw new Error('duplicate id');
        const allKeys = [...entry.queryKeys, ...(entry.unit ? [entry.unit.queryKey] : [])];
        const clash = allKeys.find((k) => keys.has(k) || k === 'context');
        if (clash) throw new Error(`query key "${clash}" is already used`);
        ids.add(entry.id);
        allKeys.forEach((k) => keys.add(k));
        filters.push(entry);
      } catch (e) {
        errors.push(`${ctxId}.${id || '?'}: ${e.message}`);
      }
    }
    if (!filters.length) {
      errors.push(`${ctxId}: no valid filters`);
      continue;
    }
    contexts[ctxId] = {
      id: ctxId,
      label: isNonEmpty(ctx.label) ? ctx.label : ctxId,
      icon: isStr(ctx.icon) ? ctx.icon : null,
      filters,
      quick: filters.filter((f) => f.quick).map((f) => f.id),
      sort: filters.find((f) => f.role === 'sort')?.id || null,
      sidebar: parseSidebar(ctxId, ctx.sidebar, filters, errors),
    };
  }
  return deepFreeze({ version: Number(raw?.version) || 0, contexts, errors });
}

export const contextIds = (config) => Object.keys(config.contexts);
export const getContext = (config, id) => config.contexts[id] || config.contexts[contextIds(config)[0]] || null;
export const getFilter = (config, contextId, filterId) => getContext(config, contextId)?.filters.find((f) => f.id === filterId) || null;
