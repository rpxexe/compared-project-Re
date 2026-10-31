process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.OTP_MODE = 'development';
process.env.ADMIN_PHONES = '9000000001';
process.env.SUPERADMIN_PHONES = '9000000002';
const http = require('http');
const mongoose = require('mongoose');
const { installFakeModels } = require('./fakeDb');

const models = installFakeModels();
// Production keeps filterFields filled via the sync job; seeded fixtures get them up front.
const { withFilterFields } = require('../../src/utils/filterFields');
const seedRaw = models.Property.seed;
models.Property.seed = (docs) => seedRaw(docs.map((d) => withFilterFields({ _id: new mongoose.Types.ObjectId(), ...d })));
models.Property.seedRaw = seedRaw;
const env = require('../../src/config/env');
env.reload();
const { createApp } = require('../../src/app');

async function startServer() {
  const server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(method, path, { token, body, headers } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json, headers: res.headers };
  }
  // Logs a phone in through the real OTP endpoints and returns { token, user }.
  async function login(phone) {
    models.Otp._rows.length = 0; // skip resend cooldown between helper logins
    const s = await call('POST', '/auth/send-otp', { body: { phone } });
    const v = await call('POST', '/auth/verify-otp', { body: { phone, otp: s.body.devOtp } });
    return v.body;
  }
  return { base, call, login, close: () => new Promise((r) => server.close(r)), models, oid: () => new mongoose.Types.ObjectId() };
}

module.exports = { startServer, models, env };
