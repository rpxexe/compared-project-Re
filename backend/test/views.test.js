const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

let t; let user; let admin; let propertyId;
test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  propertyId = String(models.Property._rows.find((p) => !p.approvalStatus || p.approvalStatus === 'approved')._id);
  user = await t.login('9866666666');
  await t.call('PATCH', '/users/me', { token: user.token, body: { name: 'Lead Person' } });
  admin = await t.login('9000000001');
});
test.after(() => t.close());

test('property views: guests are not stored, signed-in views upsert one lead row', async () => {
  models.PropertyView.reset();
  assert.equal((await t.call('POST', `/properties/${propertyId}/view`)).status, 204);
  assert.equal(models.PropertyView._rows.length, 0);

  assert.equal((await t.call('POST', `/properties/${propertyId}/view`, { token: user.token })).status, 204);
  assert.equal((await t.call('POST', `/properties/${propertyId}/view`, { token: user.token })).status, 204);
  assert.equal(models.PropertyView._rows.length, 1);
  const row = models.PropertyView._rows[0];
  assert.equal(row.views, 2);
  assert.equal(row.phone, '9866666666');
  assert.equal(row.name, 'Lead Person');
  assert.ok(row.propertyTitle);
  assert.ok(row.firstViewedAt <= row.lastViewedAt);
});

test('property views: unknown property -> 404, bad id -> 400', async () => {
  assert.equal((await t.call('POST', `/properties/${t.oid()}/view`, { token: user.token })).status, 404);
  assert.equal((await t.call('POST', '/properties/not-an-id/view', { token: user.token })).status, 400);
});

test('my views: per user, full cards newest first, clear hides them but keeps the lead', async () => {
  const other = await t.login('9877777777');
  const ids = models.Property._rows.filter((p) => !p.approvalStatus || p.approvalStatus === 'approved').map((p) => String(p._id));
  await t.call('POST', `/properties/${ids[1]}/view`, { token: user.token });
  await t.call('POST', `/properties/${ids[2]}/view`, { token: other.token });

  assert.equal((await t.call('GET', '/users/me/views')).status, 401);
  const mine = await t.call('GET', '/users/me/views', { token: user.token });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.items.map((p) => p.id), [ids[1], propertyId]);
  assert.ok(mine.body.items[0].title && mine.body.items[0].viewedAt);
  const theirs = await t.call('GET', '/users/me/views', { token: other.token });
  assert.deepEqual(theirs.body.items.map((p) => p.id), [ids[2]]);

  assert.equal((await t.call('DELETE', '/users/me/views', { token: user.token })).status, 204);
  assert.equal((await t.call('GET', '/users/me/views', { token: user.token })).body.total, 0);
  assert.equal((await t.call('GET', '/users/me/views', { token: other.token })).body.total, 1);
  assert.equal(models.PropertyView._rows.length, 3); // leads are kept

  await t.call('POST', `/properties/${propertyId}/view`, { token: user.token });
  assert.deepEqual((await t.call('GET', '/users/me/views', { token: user.token })).body.items.map((p) => p.id), [propertyId]);
});

test('by-ids: returns public cards in the order asked, validates input', async () => {
  const ids = models.Property._rows.filter((p) => !p.approvalStatus || p.approvalStatus === 'approved').map((p) => String(p._id)).slice(0, 2).reverse();
  const r = await t.call('GET', `/properties/by-ids?ids=${ids.join(',')}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map((p) => p.id), ids);
  assert.equal((await t.call('GET', '/properties/by-ids?ids=nope')).status, 400);
  assert.deepEqual((await t.call('GET', '/properties/by-ids')).body.items, []);
});

test('admin leads: admin only, searchable, counted in stats', async () => {
  assert.equal((await t.call('GET', '/admin/leads')).status, 401);
  assert.equal((await t.call('GET', '/admin/leads', { token: user.token })).status, 403);
  const r = await t.call('GET', '/admin/leads?search=Lead', { token: admin.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 2); // this user's two viewed listings (one cleared from their own list)
  assert.ok(r.body.items.every((l) => l.phone === '9866666666'));
  assert.equal(r.body.items.find((l) => l.property === propertyId).views, 3);
  const s = await t.call('GET', '/admin/stats', { token: admin.token });
  assert.equal(s.body.leads, 3);
});
