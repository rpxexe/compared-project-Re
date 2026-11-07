const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models, env } = require('./helpers/harness');

let t;
test.before(async () => { t = await startServer(); });
test.after(() => t.close());

test('health endpoint responds', async () => {
  const r = await t.call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('unknown route returns JSON 404', async () => {
  const r = await t.call('GET', '/nope');
  assert.equal(r.status, 404);
  assert.ok(r.body.message);
});

test('JWT: missing, garbage and valid tokens', async () => {
  assert.equal((await t.call('GET', '/users/me')).status, 401);
  assert.equal((await t.call('GET', '/users/me', { token: 'garbage' })).status, 401);
  const { token, user } = await t.login('9876543211');
  const me = await t.call('GET', '/users/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, user.id);
});

test('profile: purpose + name update; broker purpose grants broker role; role cannot be self-assigned', async () => {
  const { token } = await t.login('9876543212');
  const r = await t.call('PATCH', '/users/me', { token, body: { name: 'Asha Rao', purpose: 'broker', role: 'superadmin' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.purpose, 'broker');
  assert.equal(r.body.user.role, 'broker');
  assert.equal((await t.call('PATCH', '/users/me', { token, body: { purpose: 'wizard' } })).status, 400);
});

test('phone logins never change a role (roles are managed in the CRM)', async () => {
  models.User.reset();
  const d = await t.login('9000000002');
  assert.equal(d.user.role, 'user');
});

test('the old OTP endpoints are gone (phone sign-in is Firebase)', async () => {
  assert.equal((await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } })).status, 404);
  assert.equal((await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: '123456' } })).status, 404);
});

test('invalid JSON body -> 400 JSON error', async () => {
  const r = await t.call('POST', '/auth/signin', { body: '{bad json' });
  assert.equal(r.status, 400);
});
