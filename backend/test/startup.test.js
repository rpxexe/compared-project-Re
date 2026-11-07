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
const passedConfig = (r) => r.status === 1 && !/Config error/.test(r.stderr) && /Startup failed/.test(r.stderr);

test('server refuses to start without MONGODB_URI', () => {
  const r = run({});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MONGODB_URI is missing/);
});

test('production refuses a weak JWT secret', () => {
  const r = run({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:1/x', JWT_SECRET: 'short' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /JWT_SECRET/);
});

test('valid config starts in production and development (no SMS provider settings needed)', () => {
  for (const NODE_ENV of ['production', 'development', undefined]) {
    const r = run({ ...BASE, ...(NODE_ENV ? { NODE_ENV } : {}) });
    assert.ok(passedConfig(r), `${NODE_ENV}: ${r.stderr}`);
  }
});

test('unreachable MongoDB fails fast with a clear message (no crash loop, no secret in output)', () => {
  const r = run({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://user:supersecret@127.0.0.1:1/x?serverSelectionTimeoutMS=500', JWT_SECRET: 'x'.repeat(32) });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Startup failed/);
  assert.equal(r.stderr.includes('supersecret'), false);
});
