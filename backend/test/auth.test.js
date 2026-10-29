const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models, env } = require('./helpers/harness');

let t;
test.before(async () => { t = await startServer(); });
test.after(() => t.close());
test.beforeEach(() => { models.Otp.reset(); });

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

test('send-otp rejects invalid phone numbers', async () => {
  for (const phone of ['', '123', '12345678901', 'abcdefghij', '5123456789', { $ne: 1 }]) {
    const r = await t.call('POST', '/auth/send-otp', { body: { phone } });
    assert.equal(r.status, 400, `phone ${JSON.stringify(phone)}`);
  }
});

test('send-otp returns a dev OTP in development mode and never stores it in clear text', async () => {
  const r = await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  assert.equal(r.status, 200);
  assert.match(r.body.devOtp, /^\d{6}$/);
  const rec = models.Otp._rows[0];
  assert.ok(!JSON.stringify(rec).includes(r.body.devOtp), 'OTP must be hashed');
  assert.equal(r.body.resendInSeconds, env.otpResendSeconds);
});

test('resend is blocked during the cooldown window', async () => {
  await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  const r = await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  assert.equal(r.status, 429);
  assert.ok(r.body.retryAfterSeconds > 0);
});

test('verify-otp: wrong OTP -> 401 and attempts counted, correct OTP -> token + user created', async () => {
  const s = await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  const wrong = s.body.devOtp === '111111' ? '222222' : '111111';
  const bad = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: wrong } });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, 'OTP_INVALID');
  assert.equal(models.Otp._rows[0].attempts, 1);

  const ok = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: s.body.devOtp } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.phone, '9876543210');
  assert.equal(ok.body.user.role, 'user');
  assert.equal(ok.body.isNewUser, true);
  assert.equal(models.User._rows.length, 1);
  assert.equal(models.Otp._rows.length, 0, 'OTP is single-use');

  const reuse = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: s.body.devOtp } });
  assert.equal(reuse.status, 401);
});

test('verify-otp: malformed OTP -> 400', async () => {
  const r = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: '12ab' } });
  assert.equal(r.status, 400);
});

test('verify-otp: expired OTP -> 401 OTP_EXPIRED', async () => {
  const s = await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  models.Otp._rows[0].expiresAt = new Date(Date.now() - 1000);
  const r = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: s.body.devOtp } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'OTP_EXPIRED');
});

test('verify-otp: locks after too many wrong attempts, even with the right code', async () => {
  const s = await t.call('POST', '/auth/send-otp', { body: { phone: '9876543210' } });
  const wrong = s.body.devOtp === '111111' ? '222222' : '111111';
  for (let i = 0; i < env.otpMaxAttempts; i += 1) await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: wrong } });
  const r = await t.call('POST', '/auth/verify-otp', { body: { phone: '9876543210', otp: s.body.devOtp } });
  assert.equal(r.status, 429);
});

test('twilio mode never returns the OTP and sends the SMS through the provider', async () => {
  const { setSmsSender } = require('../src/utils/sms');
  const sent = [];
  setSmsSender(async (to, body) => { sent.push({ to, body }); });
  process.env.OTP_MODE = 'twilio';
  env.reload();
  const r = await t.call('POST', '/auth/send-otp', { body: { phone: '9123456780' } });
  process.env.OTP_MODE = 'development';
  env.reload();
  setSmsSender(null);
  assert.equal(r.status, 200);
  assert.equal(r.body.devOtp, undefined);
  assert.equal(sent[0].to, '+919123456780');
  assert.match(sent[0].body, /\d{6}/);
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
  const admin = await t.call('GET', '/admin/stats', { token });
  assert.equal(admin.status, 403);
});

test('admin phones listed in env are elevated after OTP verification', async () => {
  const a = await t.login('9000000001');
  assert.equal(a.user.role, 'admin');
  const s = await t.login('9000000002');
  assert.equal(s.user.role, 'superadmin');
});

test('invalid JSON body -> 400 JSON error', async () => {
  const r = await t.call('POST', '/auth/send-otp', { body: '{bad json' });
  assert.equal(r.status, 400);
});
