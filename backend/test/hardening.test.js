// Regression tests for the security-hardening fixes: oversized email input, OTP attempt races,
// token revocation (logout-all), hidden listings, https-only links, getLocations input handling
// and production CORS / health output.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { startServer, models, env } = require('./helpers/harness');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/utils/password');
const { parse, isAllowedImageUrl } = require('../src/routes/postProperty');
const { normalizeProperty } = require('../src/utils/property');
const seed = require('./seed');

let t; let owner; let stranger;
const listing = { title: 'Lake View 2BHK', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '2', price: '9000000', area: '900', description: 'Bright flat near the lake.' };
const idOf = (title) => String(models.Property._rows.find((p) => (p.title || p.name) === title)._id);

test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  owner = await t.login('9811000001');
  stranger = await t.login('9811000002');
  models.Property.seed([
    { title: 'Rejected Own Listing', city: 'Pune', locality: 'Aundh', propertyType: 'Flats/Apartments', price: 5000000, approvalStatus: 'rejected', rejectionReason: 'Duplicate', dataSource: 'manual', ownerUserId: owner.user.id },
    { title: 'Website Rejected', city: 'Mumbai', locality: 'Worli', price: 9000000, status: 'rejected' },
    { title: 'Website Inactive', city: 'Mumbai', locality: 'Worli', price: 9000000, status: 'inactive' },
    { title: 'Approved Hidden Later', city: 'Mumbai', locality: 'Juhu', price: 9500000, approvalStatus: 'approved' },
  ]);
});
test.after(() => t.close());

// ----- 1. Oversized email ----------------------------------------------------------------------
test('sign-in: a 10 KB / 150 KB email is rejected with 400 immediately', async () => {
  for (const size of [10 * 1024, 150 * 1024]) {
    // Worst case for the old backtracking regex: many "@" / "." with no valid ending.
    const email = `${'a.'.repeat(size / 2)}@`;
    const started = process.hrtime.bigint();
    const r = await t.call('POST', '/auth/signin', { body: { data: { email, password: 'whatever123' } } });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal(r.status, 400, `${size} bytes`);
    assert.ok(ms < 1000, `${size} bytes took ${ms}ms`);
  }
});

test('sign-in: an email over 254 characters is rejected, never truncated into a different address', async () => {
  const password = await hashPassword('longpassword1');
  await models.SignUpUser.create({ fullName: 'Dev', email: 'dev@builder.co', password, role: 'developer', isActive: true });
  const r = await t.call('POST', '/auth/signin', { body: { email: `dev@builder.co${'m'.repeat(300)}`, password: 'longpassword1' } });
  assert.equal(r.status, 400);
  const ok = await t.call('POST', '/auth/signin', { body: { email: ' DEV@builder.co ', password: 'longpassword1' } });
  assert.equal(ok.status, 200, 'normal emails still work (trimmed, any case)');
  assert.equal((await t.call('POST', '/auth/signin', { body: { email: 'dev@builder.co', password: 'x'.repeat(5000) } })).status, 400);
});

// ----- 2. OTP attempts ------------------------------------------------------------------------
test('OTP: parallel wrong guesses cannot get more than the allowed number of comparisons', async () => {
  models.Otp.reset();
  const phone = '9811000003';
  const s = await t.call('POST', '/auth/send-otp', { body: { phone } });
  const guesses = Array.from({ length: 30 }, (_, i) => String(200000 + i)).filter((c) => c !== s.body.devOtp);
  const results = await Promise.all(guesses.map((otp) => t.call('POST', '/auth/verify-otp', { body: { phone, otp } })));
  const compared = results.filter((r) => r.body.code === 'OTP_INVALID').length;
  assert.equal(compared, env.otpMaxAttempts, `only ${env.otpMaxAttempts} guesses may be checked, got ${compared}`);
  assert.ok(results.every((r) => r.status === 401 || r.status === 429));
  // The real code no longer works either: the lockout held.
  const late = await t.call('POST', '/auth/verify-otp', { body: { phone, otp: s.body.devOtp } });
  assert.notEqual(late.status, 200);
  assert.equal(late.body.token, undefined);
});

test('OTP: parallel sends leave at most one live code per number', async () => {
  models.Otp.reset();
  const phone = '9811000006';
  const sends = await Promise.all([1, 2, 3, 4].map(() => t.call('POST', '/auth/send-otp', { body: { phone } })));
  assert.ok(sends.some((r) => r.status === 200));
  assert.ok(models.Otp._rows.filter((r) => r.phone === phone).length <= 1);
});

test('OTP: the right code sent twice in parallel signs in only once', async () => {
  models.Otp.reset();
  const phone = '9811000004';
  const s = await t.call('POST', '/auth/send-otp', { body: { phone } });
  const results = await Promise.all([1, 2, 3].map(() => t.call('POST', '/auth/verify-otp', { body: { phone, otp: s.body.devOtp } })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
});

// ----- 3. Token revocation --------------------------------------------------------------------
test('logout-all: every token issued so far stops working (401); new sign-ins work', async () => {
  const phone = '9811000005';
  const a = await t.login(phone);
  const b = await t.login(phone);
  assert.equal(jwt.decode(a.token).v, 0, 'JWTs carry the token version');
  assert.equal((await t.call('GET', '/users/me', { token: a.token })).status, 200);

  assert.equal((await t.call('POST', '/auth/logout-all')).status, 401);
  const out = await t.call('POST', '/auth/logout-all', { token: a.token });
  assert.equal(out.status, 200);
  assert.equal((await t.call('GET', '/users/me', { token: a.token })).status, 401);
  assert.equal((await t.call('GET', '/users/me', { token: b.token })).status, 401, 'other devices too');
  assert.equal((await t.call('POST', '/auth/logout-all', { token: a.token })).status, 401);

  const c = await t.login(phone);
  assert.equal(jwt.decode(c.token).v, 1);
  assert.equal((await t.call('GET', '/users/me', { token: c.token })).status, 200);
});

test('logout-all: developer (email) accounts, legacy tokens without a version and forged versions', async () => {
  const password = await hashPassword('longpassword1');
  await models.SignUpUser.create({ fullName: 'Rev Dev', email: 'rev@builder.co', password, role: 'developer', isActive: true });
  const dev = (await t.call('POST', '/auth/signin', { body: { email: 'rev@builder.co', password: 'longpassword1' } })).body;
  const id = dev.user.id;
  // Issued before token versions existed: no `v`, accepted while the account is still at version 0.
  const legacy = jwt.sign({ id }, env.secret(), { algorithm: 'HS256', expiresIn: '1h' });
  assert.equal((await t.call('GET', '/users/me', { token: legacy })).status, 200);
  const forged = jwt.sign({ id, v: '0' }, env.secret(), { algorithm: 'HS256', expiresIn: '1h' });
  assert.equal((await t.call('GET', '/users/me', { token: forged })).status, 401);

  assert.equal((await t.call('POST', '/auth/logout-all', { token: dev.token })).status, 200);
  assert.equal(models.SignUpUser._rows.find((u) => u.email === 'rev@builder.co').tokenVersion, 1);
  assert.equal((await t.call('GET', '/users/me', { token: dev.token })).status, 401);
  assert.equal((await t.call('GET', '/users/me', { token: legacy })).status, 401);
  const again = await t.call('POST', '/auth/signin', { body: { email: 'rev@builder.co', password: 'longpassword1' } });
  assert.equal((await t.call('GET', '/users/me', { token: again.body.token })).status, 200);
});

// ----- 4. Hidden listings ----------------------------------------------------------------------
test('hidden listings return 404 on every by-id route, exactly like unknown ids', async () => {
  const hidden = ['Hidden Pending Listing', 'Rejected Own Listing', 'Website Rejected', 'Website Inactive'].map(idOf);
  const tok = stranger.token;
  for (const id of hidden) {
    const checks = [
      ['GET', `/properties/${id}`, {}],
      ['GET', `/properties/${id}`, { token: tok }],
      ['GET', `/properties/${id}/reviews`, {}],
      ['POST', `/properties/${id}/reviews`, { token: tok, body: { rating: 5, comment: 'x' } }],
      ['POST', `/properties/${id}/save`, { token: tok, body: { saved: true } }],
      ['DELETE', `/properties/${id}/save`, { token: tok }],
      ['POST', '/enquiries', { token: tok, body: { propertyId: id, message: 'Interested' } }],
      ['GET', `/v2/properties/${id}`, {}],
    ];
    for (const [method, path, opts] of checks) {
      const r = await t.call(method, path, opts);
      assert.equal(r.status, 404, `${method} ${path}`);
    }
  }
  assert.equal(models.Enquiry._rows.length, 0);
  assert.equal(models.Review._rows.length, 0);
  // Not in lists either.
  const all = await t.call('GET', '/properties?limit=30');
  assert.ok(!all.body.items.some((p) => hidden.includes(p.id)));
  const byIds = await t.call('GET', `/properties/by-ids?ids=${hidden.join(',')}`);
  assert.deepEqual(byIds.body.items, []);
});

test('hidden listings: the owner can still open their own; visible listings work normally', async () => {
  const own = idOf('Rejected Own Listing');
  const r = await t.call('GET', `/properties/${own}`, { token: owner.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.property.isOwner, true);

  const visible = idOf('Skyline Residency');
  assert.equal((await t.call('GET', `/properties/${visible}`)).status, 200);
  assert.equal((await t.call('POST', `/properties/${visible}/save`, { token: stranger.token, body: { saved: true } })).status, 200);
  assert.equal((await t.call('POST', `/properties/${visible}/reviews`, { token: stranger.token, body: { rating: 4 } })).status, 201);
  assert.equal((await t.call('POST', '/enquiries', { token: stranger.token, body: { propertyId: visible } })).status, 201);
});

test('a saved listing that gets hidden disappears from the saved list', async () => {
  const id = idOf('Approved Hidden Later');
  await t.call('POST', `/properties/${id}/save`, { token: stranger.token, body: { saved: true } });
  assert.ok((await t.call('GET', '/properties/saved/list', { token: stranger.token })).body.items.some((p) => p.id === id));
  models.Property._rows.find((p) => String(p._id) === id).approvalStatus = 'rejected';
  assert.ok(!(await t.call('GET', '/properties/saved/list', { token: stranger.token })).body.items.some((p) => p.id === id));
  assert.equal((await t.call('GET', `/properties/${id}`)).status, 404);
});

// ----- 5. https-only links ---------------------------------------------------------------------
const BAD_LINKS = ['http://example.com/a', 'upi://pay?pa=x@bank', 'tel:+919999999999', 'javascript:alert(1)', 'file:///etc/passwd',
  'intent://scan/#Intent;scheme=zxing;end', 'myapp://open', 'data:text/html,<script>1</script>', 'https://user:pw@example.com/x', '//example.com/x', 'not a url'];

test('post-property: image URLs must be https (http, data:, file:, javascript: rejected)', async () => {
  for (const bad of ['http://img.test/a.jpg', 'data:image/png;base64,AAAA', 'file:///sdcard/a.jpg', 'javascript:alert(1)', 'ftp://x.test/a.jpg', 'https://u:p@img.test/a.jpg']) {
    const r = await t.call('POST', '/post-property', { token: owner.token, body: { ...listing, images: [bad] } });
    assert.equal(r.status, 400, bad);
    assert.ok(r.body.errors.images, bad);
  }
  const ok = await t.call('POST', '/post-property', { token: owner.token, body: { ...listing, images: ['https://img.test/a.jpg'] } });
  assert.equal(ok.status, 201);
});

test('post-property and edit: brochure, map and virtual tour links must be https', async () => {
  // The full matrix through the route's validator (the post-property rate limit would stop a
  // few hundred HTTP posts), then a sample over HTTP.
  for (const field of ['brochure', 'mapLink', 'virtualTours']) {
    for (const bad of BAD_LINKS) {
      const value = field === 'virtualTours' ? [bad] : bad;
      assert.ok(parse({ ...listing, [field]: value }).errors[field], `${field}=${bad}`);
    }
  }
  for (const [field, bad] of [['brochure', 'upi://pay?pa=x@bank'], ['mapLink', 'javascript:alert(1)'], ['virtualTours', ['http://tour.test/1']]]) {
    const r = await t.call('POST', '/post-property', { token: stranger.token, body: { ...listing, [field]: bad } });
    assert.equal(r.status, 400, field);
    assert.ok(r.body.errors[field], field);
  }
  const good = { brochure: 'https://cdn.test/b.pdf', mapLink: 'https://maps.google.com/?q=Baner', virtualTours: ['https://tour.test/1'] };
  const r = await t.call('POST', '/post-property', { token: owner.token, body: { ...listing, ...good } });
  assert.equal(r.status, 201);
  const id = r.body.property.id;
  const shown = (await t.call('GET', `/properties/${id}`)).body.property;
  assert.deepEqual([shown.brochure, shown.mapLink, shown.virtualTours], [good.brochure, good.mapLink, good.virtualTours]);

  for (const [field, bad] of [['brochure', 'tel:123'], ['mapLink', 'intent://x#Intent;end'], ['virtualTours', ['javascript:alert(1)']]]) {
    const e = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { [field]: bad } });
    assert.equal(e.status, 400, field);
  }
  const doc = models.Property._rows.find((p) => String(p._id) === id);
  assert.equal(doc.brochure, good.brochure, 'rejected edits change nothing');
  const edit = await t.call('PATCH', `/users/me/properties/${id}`, { token: owner.token, body: { brochure: 'https://cdn.test/b2.pdf' } });
  assert.equal(edit.status, 200);
  assert.equal(doc.brochure, 'https://cdn.test/b2.pdf');
});

test('image URL rule: http is only accepted for this API\'s own uploads, and only in development/test', () => {
  const own = 'http://192.168.1.5:5000/uploads/11111111-2222-3333-4444-555555555555.jpg';
  assert.equal(isAllowedImageUrl(own), true);
  assert.equal(isAllowedImageUrl('http://evil.test/a.jpg'), false);
  assert.equal(isAllowedImageUrl(`${own}?x=1`), false);
  const saved = env.isDevLike;
  env.isDevLike = false;
  try {
    assert.equal(isAllowedImageUrl(own), false, 'production: https only');
    assert.equal(isAllowedImageUrl(own.replace('http:', 'https:')), true);
    assert.ok(parse({ ...listing, images: [own] }).errors.images);
  } finally {
    env.isDevLike = saved;
  }
});

test('API output never hands the app a non-https brochure, map or tour link from imported data', () => {
  const n = normalizeProperty({ _id: 'x', brochure: 'tel:123', mapLink: 'http://maps.test', virtualTours: ['javascript:alert(1)', 'https://tour.test/ok', 'upi://pay'] });
  assert.equal(n.brochure, '');
  assert.equal(n.mapLink, '');
  assert.deepEqual(n.virtualTours, ['https://tour.test/ok']);
  // The v2 contract passes raw fields through; these are sanitised there too.
  const { toContractProperty } = require('../src/utils/contractProperty');
  const c = toContractProperty({ _id: 'x', brochure: 'intent://x#Intent;end', mapLink: 'https://maps.test/x', virtualTours: ['upi://pay', 'https://tour.test/ok'] });
  assert.deepEqual([c.brochure, c.mapLink, c.virtualTours], ['', 'https://maps.test/x', ['https://tour.test/ok']]);
});

// ----- 6. getLocations -------------------------------------------------------------------------
test('locations: a database failure returns a generic 500, never the raw error message', async () => {
  models.Property.aggregateError = new Error('connect failed for mongodb://admin:hunter2@db.internal:27017');
  try {
    const r = await t.call('GET', '/properties/locations');
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('hunter2'));
    assert.ok(!JSON.stringify(r.body).includes('db.internal'));
  } finally {
    models.Property.aggregateError = null;
  }
});

test('locations: malformed query values (arrays, junk) never crash or leak errors', async () => {
  for (const qs of ['search=a&search=b', 'q=a&q=b', 'search[$ne]=x', 'city=Pune&city=Mumbai', 'limit=5&limit=9', 'page=abc&limit=-4', 'limit=99999', `search=${'x'.repeat(5000)}`]) {
    const r = await t.call('GET', `/properties/locations?${qs}`);
    assert.equal(r.status, 200, qs);
    assert.ok(Array.isArray(r.body.locations), qs);
    assert.ok(r.body.limit >= 1 && r.body.limit <= 50, qs);
  }
  const andheri = await t.call('GET', '/properties/locations?search=andheri');
  assert.deepEqual(andheri.body.locations.map((l) => l.formatted), ['Andheri West, Mumbai']);
  const hidden = await t.call('GET', '/properties/locations?search=worli');
  assert.equal(hidden.body.total, 0, 'hidden listings add no locations');
});

// ----- 7. Production CORS and health ------------------------------------------------------------
async function withProductionApp(corsOrigins, fn) {
  const saved = { isDevLike: env.isDevLike, corsOrigins: env.corsOrigins };
  Object.assign(env, { isDevLike: false, corsOrigins });
  const server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
    Object.assign(env, saved);
  }
}

test('production CORS: empty CORS_ORIGINS sends no CORS headers at all; health says only ok', async () => {
  await withProductionApp([], async (base) => {
    const get = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.test' } });
    assert.equal(get.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(await get.json(), { ok: true });
    const pre = await fetch(`${base}/properties`, { method: 'OPTIONS', headers: { Origin: 'https://evil.test', 'Access-Control-Request-Method': 'GET' } });
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
    // The mobile app sends no Origin and is unaffected.
    assert.equal((await fetch(`${base}/properties`)).status, 200);
  });
});

test('production CORS: only the configured origins are allowed', async () => {
  await withProductionApp(['https://app.test'], async (base) => {
    const ok = await fetch(`${base}/health`, { headers: { Origin: 'https://app.test' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.test');
    const evil = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.test' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
  });
});

test('development health keeps its diagnostics', async () => {
  const r = await t.call('GET', '/health');
  assert.equal(r.body.ok, true);
  assert.ok('database' in r.body);
});
