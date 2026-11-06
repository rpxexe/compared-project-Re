const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

// The child runs from an empty temp folder so it can NEVER pick up your real backend/.env
// (dotenv reads ".env" from the current working directory). Only the variables passed below exist.
const SERVER = path.join(__dirname, '../src/server.js');
const run = (extra) => spawnSync(process.execPath, [SERVER], {
  cwd: os.tmpdir(),
  env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extra },
  encoding: 'utf8',
  timeout: 20000,
});
// Valid apart from the database, which is unreachable: a run that gets past config validation
// fails with "Startup failed" instead of "Config error".
const BASE = { MONGODB_URI: 'mongodb://127.0.0.1:1/x?serverSelectionTimeoutMS=300', JWT_SECRET: 'x'.repeat(32) };
const TWILIO = { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'token', TWILIO_PHONE_NUMBER: '+15550000000' };
const passedConfig = (r) => r.status === 1 && !/Config error/.test(r.stderr) && /Startup failed/.test(r.stderr);

test('server refuses to start without MONGODB_URI', () => {
  const r = run({});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MONGODB_URI is missing/);
});

test('production refuses weak JWT secret and development OTP mode', () => {
  const r = run({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:1/x', JWT_SECRET: 'short', OTP_MODE: 'development' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /JWT_SECRET/);
  assert.match(r.stderr, /OTP_MODE/);
});

test('OTP fail-closed: production + development OTP refuses to start (any spelling)', () => {
  for (const [NODE_ENV, OTP_MODE] of [['production', 'development'], [' Production ', ' DEVELOPMENT ']]) {
    const r = run({ ...BASE, ...TWILIO, NODE_ENV, OTP_MODE });
    assert.equal(r.status, 1, `${NODE_ENV}/${OTP_MODE}`);
    assert.match(r.stderr, /Config error: OTP_MODE must be "twilio"/);
  }
});

test('OTP fail-closed: a missing or unknown NODE_ENV is NOT development', () => {
  const missing = run({ ...BASE, OTP_MODE: 'development' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Config error: OTP_MODE must be "twilio".*not set/);

  const typo = run({ ...BASE, NODE_ENV: 'prod', OTP_MODE: 'development' });
  assert.equal(typo.status, 1);
  assert.match(typo.stderr, /Config error: OTP_MODE must be "twilio"/);

  // OTP_MODE unset outside development defaults to real SMS, which then needs Twilio settings.
  const unset = run({ ...BASE });
  assert.equal(unset.status, 1);
  assert.match(unset.stderr, /Config error: OTP_MODE=twilio needs TWILIO_ACCOUNT_SID/);

  const bogus = run({ ...BASE, NODE_ENV: 'development', OTP_MODE: 'sms' });
  assert.match(bogus.stderr, /Config error: OTP_MODE must be one of/);
});

test('OTP: development + development OTP is allowed, with a warning', () => {
  const r = run({ ...BASE, NODE_ENV: 'development', OTP_MODE: 'development' });
  assert.ok(passedConfig(r), r.stderr);
});

test('OTP: production + Twilio (trimmed, any case) is allowed', () => {
  const r = run({ ...BASE, ...TWILIO, NODE_ENV: 'production', OTP_MODE: ' Twilio ' });
  assert.ok(passedConfig(r), r.stderr);
  const noNodeEnv = run({ ...BASE, ...TWILIO, OTP_MODE: 'twilio' });
  assert.ok(passedConfig(noNodeEnv), noNodeEnv.stderr);
});

test('unreachable MongoDB fails fast with a clear message (no crash loop, no secret in output)', () => {
  const r = run({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://user:supersecret@127.0.0.1:1/x?serverSelectionTimeoutMS=500', JWT_SECRET: 'x'.repeat(32) });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Startup failed/);
  assert.equal(r.stderr.includes('supersecret'), false);
});
