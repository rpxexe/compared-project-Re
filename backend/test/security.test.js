const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startServer, models, env } = require('./helpers/harness');

let t;
test.before(async () => { t = await startServer(); });
test.after(() => t.close());

test('security headers are sent on API responses', async () => {
  const r = await t.call('GET', '/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('strict-transport-security') || '', /max-age=31536000/);
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('signin with an unknown email is rejected and never creates an account', async () => {
  const r = await t.call('POST', '/auth/signin', { body: { data: { email: 'nobody@example.com', password: 'whatever123' } } });
  assert.equal(r.status, 401);
  assert.equal(r.body.message, 'Invalid email or password');
  assert.equal(models.SignUpUser._rows.length, 0);
});

test('repeated failed sign-ins for one account are throttled', async () => {
  const body = { data: { email: 'target@example.com', password: 'wrong-password' } };
  for (let i = 0; i < 8; i += 1) assert.equal((await t.call('POST', '/auth/signin', { body })).status, 401);
  const blocked = await t.call('POST', '/auth/signin', { body });
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
});

test('tokens signed with a different algorithm are rejected', async () => {
  const { user } = await t.login('9876500002');
  const forged = jwt.sign({ id: user.id }, env.secret(), { algorithm: 'HS512' });
  assert.equal((await t.call('GET', '/users/me', { token: forged })).status, 401);
});
