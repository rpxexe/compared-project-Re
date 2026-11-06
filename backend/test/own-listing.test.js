const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

const validPost = { title: 'Sea Breeze 2BHK', city: 'Thane', locality: 'Ghodbunder Road', propertyType: 'Flats/Apartments', bhk: '2', price: '7500000', area: '820', description: 'Bright corner flat with sea view.', furnishing: 'semi-furnished' };

let t; let owner; let other; let id;
test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  owner = await t.login('9811111222');
  other = await t.login('9811111333');
  const r = await t.call('POST', '/post-property', { token: owner.token, body: validPost });
  id = r.body.property.id;
});
test.after(() => t.close());

test('own listing: read returns raw editable values and the locked fields', async () => {
  assert.equal((await t.call('GET', `/users/me/properties/${id}`)).status, 401);
  const r = await t.call('GET', `/users/me/properties/${id}`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.property.price, 7500000);
  assert.equal(r.body.property.area, 820);
  assert.equal(r.body.property.city, 'Thane');
  assert.deepEqual(r.body.locked.sort(), ['address', 'bhk', 'category', 'city', 'locality', 'propertyType']);
});

test('own listing: other users and imported listings are not found', async () => {
  assert.equal((await t.call('GET', `/users/me/properties/${id}`, { token: other.token })).status, 404);
  assert.equal((await t.call('PATCH', `/users/me/properties/${id}`, { token: other.token, body: { price: 1 } })).status, 404);
  assert.equal((await t.call('DELETE', `/users/me/properties/${id}`, { token: other.token })).status, 404);
  const imported = String(models.Property._rows.find((p) => p.dataSource !== 'manual')._id);
  assert.equal((await t.call('PATCH', `/users/me/properties/${imported}`, { token: owner.token, body: { price: 1 } })).status, 404);
});

test('own listing: edits are validated, saved and recompute filters; live listings stay live', async () => {
  const doc = () => models.Property._rows.find((p) => String(p._id) === id);
  assert.equal(doc().approvalStatus, 'approved');

  const bad = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { price: -3, title: 'x' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.price && bad.body.errors.title);

  const ok = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { price: '8100000', title: 'Sea Breeze 2BHK – renovated', furnishing: 'furnished', city: 'Thane' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.property.approvalStatus, 'approved');
  assert.equal(doc().price, 8100000);
  assert.equal(doc().title, 'Sea Breeze 2BHK – renovated');
  assert.equal(doc().furnishing, 'furnished');
  assert.equal(doc().city, 'Thane');
  assert.equal(doc().bhk, '2');
  assert.ok(doc().filterFields);
});

test('own listing: editing a rejected listing keeps it rejected (no self-approval)', async () => {
  const doc = () => models.Property._rows.find((p) => String(p._id) === id);
  doc().approvalStatus = 'rejected';
  doc().rejectionReason = 'Blurry photos';

  const r = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { title: 'Sea Breeze 2BHK – new photos' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.property.approvalStatus, 'rejected');
  assert.equal(doc().approvalStatus, 'rejected');
  assert.equal(doc().rejectionReason, 'Blurry photos');
  assert.equal(doc().title, 'Sea Breeze 2BHK – new photos');
  // Still hidden from everyone but the owner.
  assert.equal((await t.call('GET', `/properties/${id}`, { token: other.token })).status, 404);
  assert.equal((await t.call('GET', `/properties/${id}`, { token: owner.token })).status, 200);

  doc().approvalStatus = 'pending';
  await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { price: '8200000' } });
  assert.equal(doc().approvalStatus, 'pending');
  doc().approvalStatus = 'approved';
  delete doc().rejectionReason;
});

test('own listing: location, BHK and property type cannot be changed', async () => {
  for (const body of [{ city: 'Pune' }, { locality: 'Baner' }, { bhk: '3' }, { propertyType: 'Villa' }, { category: 'commercial' }]) {
    const r = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(Object.keys(r.body.errors).length);
  }
  const doc = models.Property._rows.find((p) => String(p._id) === id);
  assert.equal(doc.city, 'Thane');
  assert.equal(doc.bhk, '2');
});

test('own listing: delete removes it and it disappears from my properties', async () => {
  assert.equal((await t.call('DELETE', `/users/me/properties/${id}`, { token: owner.token })).status, 200);
  assert.equal((await t.call('GET', `/users/me/properties/${id}`, { token: owner.token })).status, 404);
  const mine = await t.call('GET', '/users/me/properties', { token: owner.token });
  assert.ok(!mine.body.items.some((p) => p.id === id));
});
