const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

let t;
test.before(async () => {
  t = await startServer();
  models.Property.reset();
  models.Property.seed(seed);
});
test.after(() => t.close());

test('insights aggregate public listings for a city: price by BHK and listings by stage', async () => {
  const r = await t.call('GET', '/properties/insights?city=Mumbai');
  assert.equal(r.status, 200);
  assert.equal(r.body.listings, 3, 'pending listing is excluded');
  assert.deepEqual(r.body.priceByBhk.map((b) => [b.bhk, b.medianPrice, b.listings]), [['2', 12500000, 1], ['3', 30000000, 1]]);
  assert.deepEqual(
    Object.fromEntries(r.body.listingsByStage.map((s) => [s.stage, s.listings])),
    { 'Ready To Move': 1, 'Under Construction': 1, 'New Launch': 0 },
  );
});

test('insights route is not swallowed by /:id', async () => {
  assert.equal((await t.call('GET', '/properties/insights')).status, 200);
});

// Regression: db.js turns on strictQuery globally; on this schema-less model that silently
// dropped every filter (city search returned all listings, hidden listings leaked).
test('Property model keeps query filters despite global strictQuery', () => {
  const Property = require('../src/models/Property');
  assert.equal(Property.schema.get('strictQuery'), false);
});
