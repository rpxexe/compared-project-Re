// Rate limiting: the limiter itself (bounded memory, windows) and the per-route limits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models, env } = require('./helpers/harness');
const { rateLimit } = require('../src/utils/rateLimit');
const seed = require('./seed');

let t;
test.before(async () => { t = await startServer(); models.Property.seed(seed); });
test.after(() => t.close());

// Runs one request through a limiter and reports what happened.
function hit(limiter, ip) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      set: (k, v) => { headers[k] = v; },
      status: (code) => ({ json: (body) => resolve({ status: code, body, headers }) }),
    };
    limiter({ ip }, res, (err) => resolve(err ? { status: err.status, message: err.message, headers } : { status: 200, headers }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('limiter: blocks past the max with Retry-After, and opens again after the window', async () => {
  const limiter = rateLimit({ windowMs: 60, max: 2 });
  assert.equal((await hit(limiter, 'a')).status, 200);
  assert.equal((await hit(limiter, 'a')).status, 200);
  const blocked = await hit(limiter, 'a');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['Retry-After']) >= 1);
  assert.equal((await hit(limiter, 'b')).status, 200, 'other clients unaffected');
  await sleep(80);
  assert.equal((await hit(limiter, 'a')).status, 200);
});

test('limiter: memory is bounded - past maxKeys the oldest entries are evicted', async () => {
  const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 1, maxKeys: 100 });
  for (let i = 0; i < 5000; i += 1) await hit(limiter, `10.0.${Math.floor(i / 250)}.${i % 250}`);
  assert.ok(limiter.size() <= 100, `size ${limiter.size()}`);
  // The newest client is still tracked (and limited); the oldest was evicted.
  assert.equal((await hit(limiter, '10.0.19.249')).status, 429);
  assert.equal((await hit(limiter, '10.0.0.0')).status, 200);
});

test('v1 search, count and insights are rate limited per client', async () => {
  for (const [path, max] of [['/properties/insights', 30], ['/properties', 120], ['/properties/count', 240]]) {
    const ip = `192.0.2.${max}`;
    for (let i = 0; i < max; i += 1) {
      const r = await t.call('GET', path, { headers: { 'X-Forwarded-For': ip } });
      assert.equal(r.status, 200, `${path} #${i + 1}`);
    }
    const r = await t.call('GET', path, { headers: { 'X-Forwarded-For': ip } });
    assert.equal(r.status, 429, path);
    assert.equal((await t.call('GET', path, { headers: { 'X-Forwarded-For': '192.0.2.250' } })).status, 200, `${path}: other clients unaffected`);
  }
});

test('enquiries, reviews and new listings are rate limited per user', async () => {
  const { signToken } = require('../src/middleware/auth');
  const user = await models.User.create({ phone: '9812300100', role: 'user', isActive: true });
  const other = await models.User.create({ phone: '9812300101', role: 'user', isActive: true });
  const [token, otherToken] = [signToken(user), signToken(other)];
  const id = String(models.Property._rows.find((p) => p.title === 'Skyline Residency')._id);

  for (let i = 0; i < 20; i += 1) assert.equal((await t.call('POST', '/enquiries', { token, body: { propertyId: id } })).status, 201);
  assert.equal((await t.call('POST', '/enquiries', { token, body: { propertyId: id } })).status, 429);
  assert.equal((await t.call('POST', '/enquiries', { token: otherToken, body: { propertyId: id } })).status, 201);

  for (let i = 0; i < 20; i += 1) assert.equal((await t.call('POST', `/properties/${id}/reviews`, { token, body: { rating: 4 } })).status, 201);
  assert.equal((await t.call('POST', `/properties/${id}/reviews`, { token, body: { rating: 4 } })).status, 429);

  const post = { title: 'Rate Flat', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '2', price: '9000000', area: '900', description: 'A flat for the limit test.' };
  for (let i = 0; i < 30; i += 1) assert.equal((await t.call('POST', '/post-property', { token, body: post })).status, 201);
  assert.equal((await t.call('POST', '/post-property', { token, body: post })).status, 429);
  assert.equal((await t.call('POST', '/post-property', { token: otherToken, body: post })).status, 201);
});

test('TRUST_PROXY: hop count by default, configurable from the environment', () => {
  const saved = process.env.TRUST_PROXY;
  try {
    for (const [raw, expected] of [[undefined, 1], ['', 1], ['2', 2], ['false', false], ['TRUE', true], ['loopback, 10.0.0.0/8', ['loopback', '10.0.0.0/8']]]) {
      if (raw === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = raw;
      env.reload();
      assert.deepEqual(env.trustProxy, expected, String(raw));
    }
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = saved;
    env.reload();
  }
});
