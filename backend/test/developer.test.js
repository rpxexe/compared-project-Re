const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { startServer, models } = require('./helpers/harness');
const { hashPassword } = require('../src/utils/password');
const { createDeveloper, parseArgs } = require('../scripts/create-developer');

const listing = { title: 'Skyline Towers 3BHK', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '3', price: '15000000', area: '1350', description: 'Brand new tower with river views.', category: 'residential' };

let t; let dev; let owner; let created;
test.before(async () => {
  t = await startServer();
  created = await createDeveloper({ email: 'Sales@Skyline.test', name: 'Skyline Builders', phone: '9876501234' });
  const signin = await t.call('POST', '/auth/signin', { body: { data: { email: 'sales@skyline.test', password: created.password } } });
  dev = signin.body;
  owner = await t.login('9822222111');
});
test.after(() => t.close());

test('public developer sign-up no longer exists: /auth/signup -> 404, no account created', async () => {
  const before = models.SignUpUser._rows.length;
  const r = await t.call('POST', '/auth/signup', { body: { data: { fullName: 'Mallory', email: 'mallory@evil.test', password: 'longpassword1' } } });
  assert.equal(r.status, 404);
  assert.equal(models.SignUpUser._rows.length, before);
});

test('create:developer creates a working developer account with a strong, hashed, one-time password', async () => {
  const row = models.SignUpUser._rows.find((u) => u.email === 'sales@skyline.test');
  assert.ok(row);
  assert.equal(row.role, 'developer');
  assert.equal(row.fullName, 'Skyline Builders');
  assert.equal(row.phone, '9876501234');
  assert.equal(row.tokenVersion, 0);
  assert.match(created.password, /^[A-Za-z0-9_-]{24}$/);
  assert.match(row.password, /^scrypt:/);
  assert.ok(!JSON.stringify(row).includes(created.password), 'plain-text password is never stored');
  assert.equal(dev.user.role, 'developer');
  assert.equal(dev.user.purpose, 'developer');
  assert.equal((await t.call('GET', '/users/me', { token: dev.token })).status, 200);
});

test('create:developer refuses duplicates (any letter case) and bad input without changing anything', async () => {
  const before = JSON.stringify(models.SignUpUser._rows);
  await assert.rejects(createDeveloper({ email: 'SALES@skyline.test', name: 'Imposter' }), /already exists/);
  await assert.rejects(createDeveloper({ email: 'not-an-email', name: 'X Builders' }), /valid email/);
  await assert.rejects(createDeveloper({ email: 'a@b.co', name: 'X' }), /2-60/);
  await assert.rejects(createDeveloper({ email: 'a@b.co', name: 'Good Name', phone: '12' }), /Phone/);
  await assert.rejects(createDeveloper({ email: `${'a'.repeat(300)}@b.co`, name: 'Good Name' }), /valid email/);
  assert.equal(JSON.stringify(models.SignUpUser._rows), before);
});

test('create:developer CLI: argument parsing and usage errors', () => {
  assert.deepEqual(parseArgs(['--email', 'a@b.co', '--name', 'A B', '--phone=9876543210']), { email: 'a@b.co', name: 'A B', phone: '9876543210' });
  assert.throws(() => parseArgs(['--role', 'admin']), /Unknown argument/);
  assert.throws(() => parseArgs(['--email']), /needs a value/);
  // The real CLI exits 1 with usage before touching any database.
  const r = spawnSync(process.execPath, [path.join(__dirname, '../scripts/create-developer.js'), '--email', 'a@b.co'], {
    cwd: os.tmpdir(), env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage: npm run create:developer/);
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
