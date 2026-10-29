const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

let t; let buyer; let owner;
test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  buyer = await t.login('9811111111');
  owner = await t.login('9822222222');
});
test.after(() => t.close());
const firstId = () => models.Property._rows[0]._id.toString();

test('save requires auth, validates ids, saves, lists and unsaves', async () => {
  const id = firstId();
  assert.equal((await t.call('POST', `/properties/${id}/save`)).status, 401);
  assert.equal((await t.call('POST', '/properties/bad/save', { token: buyer.token })).status, 400);
  assert.equal((await t.call('POST', `/properties/${t.oid()}/save`, { token: buyer.token })).status, 404);

  const saved = await t.call('POST', `/properties/${id}/save`, { token: buyer.token });
  assert.deepEqual(saved.body, { saved: true });
  const again = await t.call('POST', `/properties/${id}/save`, { token: buyer.token, body: { saved: true } });
  assert.deepEqual(again.body, { saved: true }, 'explicit saved:true is idempotent');

  const list = await t.call('GET', '/properties/saved/list', { token: buyer.token });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].id, id);
  const me = await t.call('GET', '/users/me', { token: buyer.token });
  assert.deepEqual(me.body.savedIds, [id]);

  const toggled = await t.call('POST', `/properties/${id}/save`, { token: buyer.token });
  assert.deepEqual(toggled.body, { saved: false });
  assert.equal((await t.call('GET', '/properties/saved/list', { token: buyer.token })).body.items.length, 0);
  await t.call('POST', `/properties/${id}/save`, { token: buyer.token });
  assert.deepEqual((await t.call('DELETE', `/properties/${id}/save`, { token: buyer.token })).body, { saved: false });
});

test('saved lists are per-user', async () => {
  const id = firstId();
  await t.call('POST', `/properties/${id}/save`, { token: buyer.token, body: { saved: true } });
  assert.equal((await t.call('GET', '/properties/saved/list', { token: owner.token })).body.items.length, 0);
  await t.call('POST', `/properties/${id}/save`, { token: buyer.token, body: { saved: false } });
});

const validPost = { title: 'Sea Breeze 2BHK', city: 'Thane', locality: 'Ghodbunder Road', propertyType: 'Flats/Apartments', bhk: '2', price: '7500000', area: '820', description: 'Bright corner flat with sea view.' };

test('post-property: auth + validation errors listed per field', async () => {
  assert.equal((await t.call('POST', '/post-property', { body: validPost })).status, 401);
  const r = await t.call('POST', '/post-property', { token: owner.token, body: { title: 'x', price: -5, images: ['ftp://bad'] } });
  assert.equal(r.status, 400);
  for (const f of ['title', 'city', 'locality', 'propertyType', 'bhk', 'price', 'area', 'description', 'images']) assert.ok(r.body.errors[f], `error for ${f}`);
});

test('post-property: creates a pending manual listing that is hidden publicly but visible to its owner', async () => {
  const r = await t.call('POST', '/post-property', { token: owner.token, body: { ...validPost, parking: '1', furnishing: 'semi-furnished', amenities: ['Lift', 'Lift', 'Garden'], images: ['https://img.test/x.jpg'], role: 'admin', approvalStatus: 'approved', ownerUserId: 'hacker' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.property.approvalStatus, 'pending');
  const row = models.Property._rows.find((p) => p.title === 'Sea Breeze 2BHK');
  assert.equal(row.dataSource, 'manual');
  assert.equal(row.ownerUserId, owner.user.id, 'mass-assignment of owner is ignored');
  assert.equal(row.price, 7500000);
  assert.deepEqual(row.amenities, ['Lift', 'Garden']);
  assert.equal(row.coverImage, 'https://img.test/x.jpg');
  assert.equal((await t.call('GET', '/properties?search=Sea%20Breeze')).body.total, 0);
  assert.equal((await t.call('GET', `/properties/${row._id}`)).status, 404);
  const mine = await t.call('GET', '/users/me/properties', { token: owner.token });
  assert.equal(mine.body.items.length, 1);
  assert.equal(mine.body.items[0].approvalStatus, 'pending');
});

test('plots/commercial do not require BHK', async () => {
  const r = await t.call('POST', '/post-property', { token: owner.token, body: { ...validPost, title: 'Corner Plot', propertyType: 'Plot', bhk: '' } });
  assert.equal(r.status, 201);
});

test('enquiry: stores user, phone, property, title, message, source, and appears in my enquiries', async () => {
  const id = firstId();
  assert.equal((await t.call('POST', '/enquiries', { body: { propertyId: id } })).status, 401);
  assert.equal((await t.call('POST', '/enquiries', { token: buyer.token, body: { propertyId: 'bad' } })).status, 400);
  assert.equal((await t.call('POST', '/enquiries', { token: buyer.token, body: { propertyId: String(t.oid()) } })).status, 404);
  const r = await t.call('POST', '/enquiries', { token: buyer.token, body: { propertyId: id, message: 'Is it available for a site visit?' } });
  assert.equal(r.status, 201);
  const row = models.Enquiry._rows[0];
  assert.equal(row.phone, '9811111111');
  assert.equal(row.propertyTitle, 'Skyline Residency');
  assert.equal(row.source, 'mobile-app');
  assert.equal(row.status, 'new');
  const mine = await t.call('GET', '/users/me/enquiries', { token: buyer.token });
  assert.equal(mine.body.items.length, 1);
});

test('ratings: validation, create, update (one per user), summary, public reads, delete', async () => {
  const id = firstId();
  assert.equal((await t.call('POST', `/properties/${id}/reviews`, { body: { rating: 5 } })).status, 401);
  for (const rating of [0, 6, 2.5, 'x', null]) assert.equal((await t.call('POST', `/properties/${id}/reviews`, { token: buyer.token, body: { rating } })).status, 400, `rating ${rating}`);

  const a = await t.call('POST', `/properties/${id}/reviews`, { token: buyer.token, body: { rating: 4, comment: 'Great amenities' } });
  assert.equal(a.status, 201);
  assert.deepEqual([a.body.summary.average, a.body.summary.count], [4, 1]);
  const b = await t.call('POST', `/properties/${id}/reviews`, { token: owner.token, body: { rating: 5 } });
  assert.deepEqual([b.body.summary.average, b.body.summary.count], [4.5, 2]);
  const upd = await t.call('POST', `/properties/${id}/reviews`, { token: buyer.token, body: { rating: 2 } });
  assert.deepEqual([upd.body.summary.average, upd.body.summary.count], [3.5, 2], 'a second rating replaces the first');
  assert.equal(models.Review._rows.length, 2);

  const pub = await t.call('GET', `/properties/${id}/reviews`);
  assert.equal(pub.body.summary.count, 2);
  assert.equal(pub.body.myReview, null);
  assert.equal(pub.body.items.every((r) => !('user' in r) && !('phone' in r)), true, 'reviewer identity is not leaked');
  const mine = await t.call('GET', `/properties/${id}/reviews`, { token: buyer.token });
  assert.equal(mine.body.myReview.rating, 2);

  const list = await t.call('GET', '/properties');
  assert.deepEqual(list.body.items.find((i) => i.id === id).rating, { average: 3.5, count: 2 });
  assert.equal(list.body.items.find((i) => i.id !== id).rating, null);

  const top = await t.call('GET', '/properties/top-rated');
  assert.equal(top.body.items.length, 1);
  const bySort = await t.call('GET', '/properties?sort=rating');
  assert.equal(bySort.body.items[0].id, id);

  const del = await t.call('DELETE', `/properties/${id}/reviews/mine`, { token: buyer.token });
  assert.deepEqual([del.body.summary.average, del.body.summary.count], [5, 1]);
});

test('users cannot rate their own listing', async () => {
  const row = models.Property._rows.find((p) => p.title === 'Sea Breeze 2BHK');
  models.Property._rows.find((p) => p === row).approvalStatus = 'approved';
  const r = await t.call('POST', `/properties/${row._id}/reviews`, { token: owner.token, body: { rating: 5 } });
  assert.equal(r.status, 403);
});

test('a disabled account loses access immediately', async () => {
  const u = await t.login('9833333333');
  models.User._rows.find((x) => x.phone === '9833333333').isActive = false;
  assert.equal((await t.call('GET', '/users/me', { token: u.token })).status, 401);
});
