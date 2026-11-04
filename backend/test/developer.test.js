const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const { hashPassword } = require('../src/utils/password');

const listing = { title: 'Skyline Towers 3BHK', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '3', price: '15000000', area: '1350', description: 'Brand new tower with river views.', category: 'residential' };

let t; let dev; let owner;
test.before(async () => {
  t = await startServer();
  const signup = await t.call('POST', '/auth/signup', { body: { data: { fullName: 'Skyline Builders', email: 'sales@skyline.test', password: 'longpassword1' } } });
  dev = signup.body;
  owner = await t.login('9822222111');
});
test.after(() => t.close());

test('developer: email sign-up creates a developer account', () => {
  assert.equal(dev.user.role, 'developer');
  assert.equal(dev.user.purpose, 'developer');
});

test('developer: older email accounts become developers on sign-in; staff keep their role', async () => {
  const password = await hashPassword('longpassword1');
  await models.SignUpUser.create({ fullName: 'Old Builder', email: 'old@builder.test', password, role: 'user', isActive: true });
  await models.SignUpUser.create({ fullName: 'Staff', email: 'staff@crm.test', password, role: 'admin', isActive: true });

  const old = await t.call('POST', '/auth/signin', { body: { email: 'old@builder.test', password: 'longpassword1' } });
  assert.equal(old.body.user.role, 'developer');
  assert.equal(models.SignUpUser._rows.find((u) => u.email === 'old@builder.test').role, 'developer');

  const staff = await t.call('POST', '/auth/signin', { body: { email: 'staff@crm.test', password: 'longpassword1' } });
  assert.equal(staff.body.user.role, 'admin');
});

test('developer: listings must be for sale', async () => {
  for (const listingType of ['rent', undefined]) {
    const r = await t.call('POST', '/post-property', { token: dev.token, body: { ...listing, listingType } });
    assert.equal(r.status, 400, String(listingType));
    assert.ok(r.body.errors.listingType);
  }
  const ok = await t.call('POST', '/post-property', { token: dev.token, body: { ...listing, listingType: 'sale' } });
  assert.equal(ok.status, 201);

  const id = ok.body.property.id;
  const toRent = await t.call('PATCH', `/users/me/properties/${id}`, { token: dev.token, body: { listingType: 'rent' } });
  assert.equal(toRent.status, 400);
  assert.ok(toRent.body.errors.listingType);
  assert.equal(models.Property._rows.find((p) => String(p._id) === id).ownerRole, 'developer');
});

test('owners can still list for rent', async () => {
  const r = await t.call('POST', '/post-property', { token: owner.token, body: { ...listing, listingType: 'rent', price: '45000' } });
  assert.equal(r.status, 201);
});
