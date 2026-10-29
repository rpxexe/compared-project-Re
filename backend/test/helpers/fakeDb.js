// In-memory stand-in for the Mongoose models, used ONLY by the test-suite (no MongoDB needed).
// It implements just the query/update operators the API uses, so route logic, auth, roles and
// query construction are exercised end-to-end. It is NOT a substitute for a real MongoDB run
// (see `npm run check:db`).
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const eqId = (a, b) => String(a) === String(b);
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isRe = (v) => v instanceof RegExp;

function matchValue(val, cond) {
  if (cond && typeof cond === 'object' && !isRe(cond) && !(cond instanceof ObjectId) && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case '$in': return arg.some((a) => matchValue(val, a));
        case '$nin': return !arg.some((a) => matchValue(val, a));
        case '$gte': return typeof val === 'number' && val >= arg;
        case '$gt': return typeof val === 'number' && val > arg;
        case '$lte': return typeof val === 'number' && val <= arg;
        case '$lt': return typeof val === 'number' && val < arg;
        case '$ne': return !matchValue(val, arg);
        case '$exists': return (val !== undefined) === arg;
        default: throw new Error(`fakeDb: unsupported operator ${op}`);
      }
    });
  }
  if (Array.isArray(val)) return val.some((v) => matchValue(v, cond));
  if (isRe(cond)) return typeof val === 'string' && cond.test(val);
  if (val instanceof ObjectId || cond instanceof ObjectId) return val != null && eqId(val, cond);
  if (val instanceof Date && cond instanceof Date) return val.getTime() === cond.getTime();
  return val === cond;
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '$and') return v.every((f) => matches(doc, f));
    if (k === '$or') return v.some((f) => matches(doc, f));
    return matchValue(getPath(doc, k), v);
  });
}

function applyUpdate(doc, update, inserting) {
  const u = update.$set || update.$addToSet || update.$pull || update.$inc || update.$setOnInsert || update.$unset ? update : { $set: update };
  Object.entries(u.$set || {}).forEach(([k, v]) => { doc[k] = v; });
  if (inserting) Object.entries(u.$setOnInsert || {}).forEach(([k, v]) => { doc[k] = v; });
  Object.entries(u.$inc || {}).forEach(([k, v]) => { doc[k] = (doc[k] || 0) + v; });
  Object.entries(u.$addToSet || {}).forEach(([k, v]) => { doc[k] = doc[k] || []; if (!doc[k].some((x) => eqId(x, v))) doc[k].push(v); });
  Object.entries(u.$pull || {}).forEach(([k, v]) => { doc[k] = (doc[k] || []).filter((x) => !eqId(x, v)); });
  Object.keys(u.$unset || {}).forEach((k) => { delete doc[k]; });
}

function cmp(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) < String(b) ? -1 : 1;
  return a < b ? -1 : 1;
}

function makeModel(name, defaults = () => ({})) {
  const rows = [];
  function structuredCloneKeepIds(d) {
    if (d instanceof ObjectId || d instanceof Date) return d;
    if (Array.isArray(d)) return d.map(structuredCloneKeepIds);
    if (d && typeof d === 'object') return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, structuredCloneKeepIds(v)]));
    return d;
  }
  class Query {
    constructor(fn) { this.fn = fn; this._sort = null; this._skip = 0; this._limit = Infinity; }
    sort(s) { this._sort = s; return this; }
    skip(n) { this._skip = n; return this; }
    limit(n) { this._limit = n; return this; }
    lean() { return this; }
    select() { return this; } // projection is a no-op for the in-memory fake
    then(res, rej) {
      try {
        let out = this.fn();
        if (Array.isArray(out)) {
          if (this._sort) out = [...out].sort((a, b) => { for (const [k, d] of Object.entries(this._sort)) { const c = cmp(getPath(a, k), getPath(b, k)); if (c) return c * d; } return 0; });
          out = out.slice(this._skip, this._skip + this._limit);
        }
        return Promise.resolve(out).then(res, rej);
      } catch (e) { return Promise.reject(e).then(res, rej); }
    }
  }
  const Model = {
    _rows: rows,
    reset() { rows.length = 0; },
    seed(docs) { docs.forEach((d) => rows.push({ _id: new ObjectId(), ...structuredCloneKeepIds(d) })); return rows; },
    async create(doc) { const d = { _id: new ObjectId(), ...defaults(), ...structuredCloneKeepIds(doc) }; if (Model.unique && rows.some((r) => Model.unique.every((k) => eqId(r[k], d[k])))) { const e = new Error('dup'); e.code = 11000; throw e; } rows.push(d); return d; },
    find: (f) => new Query(() => rows.filter((r) => matches(r, f)).map(structuredCloneKeepIds)),
    findOne: (f) => new Query(() => structuredCloneKeepIds(rows.find((r) => matches(r, f))) || null),
    findById: (id) => new Query(() => structuredCloneKeepIds(rows.find((r) => eqId(r._id, id))) || null),
    countDocuments: (f) => new Query(() => rows.filter((r) => matches(r, f)).length),
    distinct: (field, f) => new Query(() => [...new Set(rows.filter((r) => matches(r, f)).map((r) => getPath(r, field)).filter((v) => v !== undefined))]),
    async updateOne(f, u) { const r = rows.find((x) => matches(x, f)); if (r) applyUpdate(r, u); return { matchedCount: r ? 1 : 0 }; },
    findOneAndUpdate: (f, u, o = {}) => new Query(() => {
      let r = rows.find((x) => matches(x, f));
      if (!r && o.upsert) {
        r = { _id: new ObjectId(), ...defaults() };
        Object.entries(f).forEach(([k, v]) => { if (!k.startsWith('$') && !(v && typeof v === 'object' && !(v instanceof ObjectId))) r[k] = v; });
        applyUpdate(r, u, true); rows.push(r);
      } else if (r) applyUpdate(r, u, false);
      return r ? structuredCloneKeepIds(r) : null;
    }),
    async deleteOne(f) { const i = rows.findIndex((r) => matches(r, f)); if (i >= 0) rows.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    async deleteMany(f) { for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], f)) rows.splice(i, 1); return {}; },
  };
  return Model;
}

function installFakeModels() {
  const User = makeModel('User', () => ({ role: 'user', name: '', purpose: '', city: '', isActive: true, savedProperties: [], createdAt: new Date() }));
  User.ROLES = ['user', 'broker', 'admin', 'superadmin'];
  User.PURPOSES = ['broker', 'resale', 'buyer', 'investor', 'owner'];
  const models = {
    Property: makeModel('Property'),
    User,
    Otp: makeModel('Otp', () => ({ attempts: 0, lastSentAt: new Date() })),
    Enquiry: makeModel('Enquiry', () => ({ status: 'new', createdAt: new Date() })),
    Review: makeModel('Review', () => ({ createdAt: new Date() })),
    PropertyRating: makeModel('PropertyRating'),
    SignUpUser: makeModel('SignUpUser', () => ({ role: 'user', isActive: true })),
  };
  models.Review.unique = ['property', 'user'];
  const p = require.resolve('../../src/models');
  require.cache[p] = { id: p, filename: p, loaded: true, exports: models, children: [], paths: [] };
  return models;
}

module.exports = { installFakeModels, matches };
