process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
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
  // A phone (customer) account and its session, as { token, user }. Phone sign-in itself is
  // Firebase's job (covered in firebase.test.js / v2.test.js); this creates an account that is not
  // linked to Firebase yet, like the ones made by the old OTP flow.
  async function login(phone) {
    const { signToken } = require('../../src/middleware/auth');
    const { publicUser } = require('../../src/utils/user');
    const user = await models.User.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone }, $set: { lastLoginAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return { token: signToken(user), user: publicUser(user) };
  }
  return { base, call, login, close: () => new Promise((r) => server.close(r)), models, oid: () => new mongoose.Types.ObjectId() };
}

module.exports = { startServer, models, env };
