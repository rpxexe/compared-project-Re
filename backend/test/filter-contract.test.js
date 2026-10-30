// Contract between the app's filter config (frontend/src/config/filters.json) and the query
// builder: every query key and option value the app can send must actually filter. Catches a
// renamed option or a new filter the backend doesn't know yet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPropertyFilter, CONTEXTS } = require('../src/utils/propertyQuery');

const CONFIG = path.join(__dirname, '../../frontend/src/config/filters.json');
const config = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, 'utf8')) : null;

const resolve = (ref) => {
  if (typeof ref === 'string') return { id: ref, ...config.definitions[ref] };
  const { base, ...rest } = ref;
  return { ...config.definitions[base ?? ref.id], ...rest };
};
const differs = (ctx, params) => JSON.stringify(buildPropertyFilter({ context: ctx, ...params })) !== JSON.stringify(buildPropertyFilter({ context: ctx }));

test('every app filter value is understood by the API', { skip: !config && 'frontend config not present' }, () => {
  for (const [ctx, { filters }] of Object.entries(config.contexts)) {
    assert.ok(CONTEXTS[ctx], `backend knows context ${ctx}`);
    for (const f of filters.map(resolve)) {
      const where = `${ctx}.${f.id}`;
      if (f.role === 'sort') continue; // sort is checked separately below
      if (f.type === 'range') {
        const steps = f.steps || Object.values(f.stepsByUnit)[0];
        assert.ok(differs(ctx, { [f.queryKeys[0]]: String(steps[1]) }), `${where} min`);
        assert.ok(differs(ctx, { [f.queryKeys[1]]: String(steps[1]) }), `${where} max`);
        for (const u of f.unit?.options || []) {
          const a = buildPropertyFilter({ context: ctx, [f.queryKeys[0]]: '100', [f.unit.queryKey]: u.value });
          const b = buildPropertyFilter({ context: ctx, [f.queryKeys[0]]: '100', [f.unit.queryKey]: 'sqft' });
          if (u.value !== 'sqft') assert.notDeepEqual(a, b, `${where} unit ${u.value} converts`);
        }
      } else if (f.type === 'toggle') {
        assert.ok(differs(ctx, { [f.queryKey]: 'true' }), where);
      } else {
        for (const o of f.options) {
          if (o.value === '' || o.value === f.default) continue;
          for (const v of o.values || [o.value]) assert.ok(differs(ctx, { [f.queryKey]: v }), `${where}=${v}`);
        }
      }
    }
  }
});

test('every app sort option is a real sort', { skip: !config && 'frontend config not present' }, () => {
  const { buildSort } = require('../src/utils/propertyQuery');
  const fallback = JSON.stringify(buildSort(''));
  for (const o of config.definitions.sort.options) {
    if (o.value === 'rating') continue; // ranked in the controller, not via buildSort
    assert.notEqual(JSON.stringify(buildSort(o.value)), fallback, `sort=${o.value}`);
  }
});
