// Firebase customer sign-in: account linking only by verified phone (never by email), and token
// revocation (verifyIdToken with checkRevoked, revokeRefreshTokens on logout-all).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models, env } = require('./helpers/harness');
const firebase = require('../src/utils/firebase');
const { hashPassword } = require('../src/utils/password');

// Fake firebase-admin, so the real verifier code path (checkRevoked) runs without Google.
const adminCalls = { verify: [], revoked: [] };
const fakeAdmin = {
  apps: [],
  initializeApp() { this.apps.push({}); },
  credential: { cert: () => ({}) },
  auth: () => ({
    async verifyIdToken(token, checkRevoked) {
      adminCalls.verify.push(checkRevoked);
      const [tag, uid, phone, email, verified, state] = String(token).split('|');
      if (tag !== 'fb' || !uid) throw Object.assign(new Error('Decoding Firebase ID token failed'), { code: 'auth/argument-error' });
      if (state === 'revoked') throw Object.assign(new Error('The Firebase ID token has been revoked.'), { code: 'auth/id-token-revoked' });
      if (state === 'disabled') throw Object.assign(new Error('The user record is disabled.'), { code: 'auth/user-disabled' });
      return { uid, ...(phone ? { phone_number: phone } : {}), ...(email ? { email, email_verified: verified === '1' } : {}) };
    },
    async revokeRefreshTokens(uid) { adminCalls.revoked.push(uid); },
  }),
};
const adminPath = require.resolve('firebase-admin');
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: fakeAdmin, children: [], paths: [] };

const fb = (uid, { phone = '', email = '', verified = true, state = '' } = {}) => `fb|${uid}|${phone}|${email}|${verified ? 1 : 0}|${state}`;
const register = (token, body) => t.call('POST', '/v2/customers/register', { token, body });

let t;
test.before(async () => {
  env.firebase.projectId = 'demo-project';
  firebase.setVerifier(null);
  firebase.setRevoker(null);
  t = await startServer();
});
test.after(() => t.close());

test('linking: a Firebase email matching a password account (different phone) is NOT linked', async () => {
  const password = await hashPassword('longpassword1');
  const victim = await models.SignUpUser.create({ fullName: 'Builder', email: 'owner@builder.test', phone: '9811100001', password, role: 'developer', isActive: true });

  const r = await register(fb('uid-attacker', { phone: '+919811100002', email: 'owner@builder.test' }));
  assert.equal(r.status, 201, 'a new account is created instead');
  assert.equal(r.body.created, true);
  assert.equal(r.body.customer.accountType, 'phone');
  assert.notEqual(r.body.customer.id, String(victim._id));
  const row = models.SignUpUser._rows.find((u) => u.email === 'owner@builder.test');
  assert.equal(row.firebaseUid, undefined, 'password account untouched');

  // Email-only sign-in with that address: refused, still not linked.
  const mail = await register(fb('uid-mail-only', { email: 'OWNER@builder.test' }));
  assert.equal(mail.status, 409);
  assert.equal(row.firebaseUid, undefined);
  assert.equal(mail.body.token, undefined);
});

test('linking: a password account with the same (unverified) phone is not linked either', async () => {
  const password = await hashPassword('longpassword1');
  await models.SignUpUser.create({ fullName: 'Other Builder', email: 'other@builder.test', phone: '9811100003', password, role: 'developer', isActive: true });
  const r = await register(fb('uid-phone-dev', { phone: '+919811100003' }));
  assert.equal(r.status, 201);
  assert.equal(r.body.customer.accountType, 'phone');
  assert.equal(models.SignUpUser._rows.find((u) => u.email === 'other@builder.test').firebaseUid, undefined);
});

test('linking: a verified Firebase phone matching a phone (OTP) account links to it', async () => {
  const v1 = await t.login('9811100004');
  const r = await register(fb('uid-phone-match', { phone: '+919811100004', email: 'whatever@mail.test' }));
  assert.equal(r.status, 200);
  assert.equal(r.body.created, false);
  assert.equal(r.body.customer.id, v1.user.id);
  assert.equal(models.User._rows.find((u) => u.phone === '9811100004').firebaseUid, 'uid-phone-match');
  // Linked accounts can't be re-linked to another Firebase user.
  assert.equal((await register(fb('uid-someone-else', { phone: '+919811100004' }))).status, 409);
});

test('linking: a brand-new Firebase user gets a new account', async () => {
  const before = models.User._rows.length;
  const r = await register(fb('uid-brand-new', { phone: '+919811100005' }), { name: 'New Customer' });
  assert.equal(r.status, 201);
  assert.equal(r.body.customer.name, 'New Customer');
  assert.equal(models.User._rows.length, before + 1);
  const email = await register(fb('uid-new-mail', { email: 'fresh@mail.test' }));
  assert.equal(email.status, 201);
  assert.equal(email.body.customer.accountType, 'email');
  assert.equal((await register(fb('uid-unverified', { email: 'unverified@mail.test', verified: false }))).status, 400);
});

test('revocation: ID tokens are verified with checkRevoked=true; revoked/disabled tokens get a bare 401', async () => {
  adminCalls.verify.length = 0;
  await register(fb('uid-rev', { phone: '+919811100006' }));
  assert.ok(adminCalls.verify.length > 0);
  assert.ok(adminCalls.verify.every((flag) => flag === true), 'checkRevoked is always on');

  for (const state of ['revoked', 'disabled']) {
    const r = await t.call('GET', '/v2/customerActivity/my-activity', { token: fb('uid-rev', { phone: '+919811100006', state }) });
    assert.deepEqual([r.status, r.body], [401, { message: 'Invalid token' }], state);
  }
  assert.equal((await t.call('GET', '/v2/customerActivity/my-activity', { token: fb('uid-rev', { phone: '+919811100006' }) })).status, 200);
});

test('revocation: logout-all also revokes the linked Firebase session', async () => {
  adminCalls.revoked.length = 0;
  const r = await register(fb('uid-logout', { phone: '+919811100007' }));
  assert.equal((await t.call('POST', '/auth/logout-all', { token: r.body.token })).status, 200);
  assert.deepEqual(adminCalls.revoked, ['uid-logout']);
  assert.equal((await t.call('GET', '/users/me', { token: r.body.token })).status, 401);
});
