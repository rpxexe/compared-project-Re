const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

let t; let user; let admin; let superadmin;
test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  user = await t.login('9844444444');
  admin = await t.login('9000000001');
  superadmin = await t.login('9000000002');
});
test.after(() => t.close());

const ADMIN_ROUTES = [['GET', '/admin/stats'], ['GET', '/admin/users'], ['GET', '/admin/properties'], ['GET', '/admin/enquiries']];

test('admin APIs: anonymous -> 401, normal user -> 403, malformed token -> 401', async () => {
  for (const [m, p] of ADMIN_ROUTES) {
    assert.equal((await t.call(m, p)).status, 401, `${p} anon`);
    assert.equal((await t.call(m, p, { token: user.token })).status, 403, `${p} user`);
    assert.equal((await t.call(m, p, { token: 'x.y.z' })).status, 401, `${p} bad token`);
  }
  assert.equal((await t.call('PATCH', `/admin/properties/${t.oid()}`, { token: user.token, body: { approvalStatus: 'approved' } })).status, 403);
  assert.equal((await t.call('DELETE', `/admin/reviews/${t.oid()}`, { token: user.token })).status, 403);
});

test('a broker is not an admin', async () => {
  const b = await t.login('9855555555');
  await t.call('PATCH', '/users/me', { token: b.token, body: { purpose: 'broker' } });
  assert.equal((await t.call('GET', '/admin/stats', { token: b.token })).status, 403);
});

test('admin: stats, users, properties (including hidden), enquiries', async () => {
  const s = await t.call('GET', '/admin/stats', { token: admin.token });
  assert.equal(s.status, 200);
  assert.equal(s.body.properties, 5);
  assert.equal(s.body.pendingApprovals, 1);
  assert.equal(s.body.users >= 3, true);
  const users = await t.call('GET', '/admin/users?search=9844', { token: admin.token });
  assert.equal(users.body.items.length, 1);
  const props = await t.call('GET', '/admin/properties?approvalStatus=pending', { token: admin.token });
  assert.equal(props.body.items.length, 1);
  assert.equal(props.body.items[0].title, 'Hidden Pending Listing');
  assert.equal((await t.call('GET', '/admin/properties?search=skyline', { token: admin.token })).body.total, 1);
  assert.equal((await t.call('GET', '/admin/enquiries', { token: admin.token })).status, 200);
});

test('admin approves / rejects submissions and the public listing follows', async () => {
  const pending = models.Property._rows.find((p) => p.approvalStatus === 'pending')._id.toString();
  assert.equal((await t.call('GET', '/properties?search=Hidden')).body.total, 0);
  const bad = await t.call('PATCH', `/admin/properties/${pending}`, { token: admin.token, body: { approvalStatus: 'banana' } });
  assert.equal(bad.status, 400);
  const ok = await t.call('PATCH', `/admin/properties/${pending}`, { token: admin.token, body: { approvalStatus: 'approved', featured: true } });
  assert.equal(ok.status, 200);
  assert.equal((await t.call('GET', '/properties?search=Hidden')).body.total, 1);
  await t.call('PATCH', `/admin/properties/${pending}`, { token: admin.token, body: { approvalStatus: 'rejected', rejectionReason: 'Duplicate' } });
  assert.equal((await t.call('GET', '/properties?search=Hidden')).body.total, 0);
  assert.equal((await t.call('PATCH', `/admin/properties/${t.oid()}`, { token: admin.token, body: { featured: true } })).status, 404);
  assert.equal((await t.call('PATCH', 'x', { token: admin.token })).status, 404);
});

test('admin enquiry management', async () => {
  const id = models.Property._rows[0]._id.toString();
  await t.call('POST', '/enquiries', { token: user.token, body: { propertyId: id, message: 'Hi' } });
  const list = await t.call('GET', '/admin/enquiries?status=new', { token: admin.token });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].phone, '9844444444');
  const up = await t.call('PATCH', `/admin/enquiries/${list.body.items[0].id}`, { token: admin.token, body: { status: 'contacted' } });
  assert.equal(up.body.enquiry.status, 'contacted');
  assert.equal((await t.call('PATCH', `/admin/enquiries/${list.body.items[0].id}`, { token: admin.token, body: { status: 'nope' } })).status, 400);
});

test('only superadmin can change roles / disable users, and not themselves', async () => {
  assert.equal((await t.call('PATCH', `/admin/users/${user.user.id}`, { token: admin.token, body: { role: 'admin' } })).status, 403);
  const r = await t.call('PATCH', `/admin/users/${user.user.id}`, { token: superadmin.token, body: { role: 'admin' } });
  assert.equal(r.status, 200);
  assert.equal((await t.call('GET', '/admin/stats', { token: user.token })).status, 200, 'promotion takes effect immediately');
  assert.equal((await t.call('PATCH', `/admin/users/${user.user.id}`, { token: superadmin.token, body: { role: 'root' } })).status, 400);
  assert.equal((await t.call('PATCH', `/admin/users/${superadmin.user.id}`, { token: superadmin.token, body: { role: 'user' } })).status, 400);
  await t.call('PATCH', `/admin/users/${user.user.id}`, { token: superadmin.token, body: { role: 'user' } });
  assert.equal((await t.call('GET', '/admin/stats', { token: user.token })).status, 403, 'demotion takes effect immediately');
});

test('delete: superadmin only, and only app-created properties', async () => {
  const imported = models.Property._rows[0]._id.toString();
  assert.equal((await t.call('DELETE', `/admin/properties/${imported}`, { token: admin.token })).status, 403);
  assert.equal((await t.call('DELETE', `/admin/properties/${imported}`, { token: superadmin.token })).status, 403, 'imported data is protected');
  const manual = models.Property._rows.find((p) => p.dataSource === 'manual')._id.toString();
  assert.equal((await t.call('DELETE', `/admin/properties/${manual}`, { token: superadmin.token })).status, 200);
});

test('admin can remove an abusive review and the rating recalculates', async () => {
  const id = models.Property._rows[0]._id.toString();
  await t.call('POST', `/properties/${id}/reviews`, { token: user.token, body: { rating: 1, comment: 'spam' } });
  const review = models.Review._rows[0]._id.toString();
  assert.equal((await t.call('DELETE', `/admin/reviews/${review}`, { token: admin.token })).status, 200);
  assert.equal(models.PropertyRating._rows[0].count, 0);
  assert.equal((await t.call('GET', '/properties')).body.items.find((i) => i.id === id).rating, null);
});
