// Most imported listings use 25-27 char hex strings as their _id rather than ObjectIds. Every
// endpoint that takes a listing id must work for both formats.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

const TEXT_ID = '6a59270f3709d8a493f8190558'; // 26 chars, like the imported data
let t; let buyer;
test.before(async () => {
  t = await startServer();
  models.Property.seed([...seed, { _id: TEXT_ID, title: 'Imported Tower', city: 'Pune', locality: 'Kharadi', propertyType: 'Flats/Apartments', bhk: '2', price: 11500000, createdAt: new Date('2026-05-01') }]);
  buyer = await t.login('9844444444');
});
test.after(() => t.close());
const objectIdListing = () => models.Property._rows[0]._id.toString();

test('details and compare accept text ids alongside ObjectIds', async () => {
  const d = await t.call('GET', `/properties/${TEXT_ID}`);
  assert.equal(d.status, 200);
  assert.equal(d.body.property.id, TEXT_ID);
  const c = await t.call('GET', `/properties/compare?ids=${TEXT_ID},${objectIdListing()}`);
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.items.map((i) => i.id), [TEXT_ID, objectIdListing()]);
});

test('save, saved list and unsave work for a text id', async () => {
  assert.deepEqual((await t.call('POST', `/properties/${TEXT_ID}/save`, { token: buyer.token, body: { saved: true } })).body, { saved: true });
  const list = await t.call('GET', '/properties/saved/list', { token: buyer.token });
  assert.deepEqual(list.body.items.map((i) => i.id), [TEXT_ID]);
  assert.deepEqual((await t.call('DELETE', `/properties/${TEXT_ID}/save`, { token: buyer.token })).body, { saved: false });
});

test('enquiries and reviews work for a text id', async () => {
  const e = await t.call('POST', '/enquiries', { token: buyer.token, body: { propertyId: TEXT_ID, message: 'Site visit?' } });
  assert.equal(e.status, 201);
  const r = await t.call('POST', `/properties/${TEXT_ID}/reviews`, { token: buyer.token, body: { rating: 4 } });
  assert.equal(r.status, 201);
  const list = await t.call('GET', `/properties/${TEXT_ID}/reviews`);
  assert.equal(list.body.summary.count, 1);
  assert.equal((await t.call('DELETE', `/properties/${TEXT_ID}/reviews/mine`, { token: buyer.token })).body.summary.count, 0);
});

test('malformed ids are still rejected and unknown ones are 404', async () => {
  for (const bad of ['bad', 'zz59270f3709d8a493f8190558', '1234', `${TEXT_ID}${TEXT_ID}`]) {
    assert.equal((await t.call('GET', `/properties/${bad}`)).status, 400, bad);
  }
  assert.equal((await t.call('GET', '/properties/6a59270f3709d8a493f8190559')).status, 404);
  assert.equal((await t.call('GET', `/properties/compare?ids=${TEXT_ID},nope`)).status, 400);
});
