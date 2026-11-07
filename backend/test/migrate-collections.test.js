// The one-off collection migration (scripts/migrate-collections.js), run against an in-memory
// stand-in for a MongoDB Db: right order, dry run writes nothing, re-runs and partial runs are safe.
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../scripts/migrate-collections');

// Minimal Db: collections are arrays of documents keyed by name.
function fakeDb(initial) {
  const cols = new Map(Object.entries(initial).map(([k, v]) => [k, [...v]]));
  const matches = (doc, filter) =>
    !filter?.password || (doc.password !== undefined && !['', null].includes(doc.password));
  return {
    cols,
    listCollections: () => ({ toArray: async () => [...cols.keys()].map((name) => ({ name })) }),
    collection: (name) => ({
      countDocuments: async (filter) => (cols.get(name) || []).filter((d) => matches(d, filter)).length,
      drop: async () => { if (!cols.delete(name)) throw new Error(`ns not found: ${name}`); },
      rename: async (to) => {
        if (cols.has(to)) throw new Error(`target namespace exists: ${to}`);
        cols.set(to, cols.get(name));
        cols.delete(name);
      },
    }),
  };
}

const phone = [{ phone: '9000000001' }, { phone: '9000000002' }];
const email = [{ email: 'dev@builder.test', password: 'hash' }, { email: 'staff@crm.test', password: 'hash' }];
const views = [{ user: 'u1', property: 'p1' }];
const quiet = () => {};

test('migrate: renames in order and drops property_views', async () => {
  const db = fakeDb({ app_users: phone, signupusers: email, property_views: views, enquiries: [{}] });
  await migrate(db, { apply: true, log: quiet });
  assert.deepEqual(db.cols.get('app_customers'), phone);
  assert.deepEqual(db.cols.get('app_users'), email);
  assert.ok(!db.cols.has('signupusers'));
  assert.ok(!db.cols.has('property_views'));
  assert.equal(db.cols.get('enquiries').length, 1, 'other collections untouched');
});

test('migrate: a dry run plans every step but changes nothing', async () => {
  const db = fakeDb({ app_users: phone, signupusers: email, property_views: views });
  const lines = [];
  await migrate(db, { log: (l) => lines.push(l) });
  assert.deepEqual([...db.cols.keys()].sort(), ['app_users', 'property_views', 'signupusers']);
  assert.ok(lines.some((l) => l.includes('rename "app_users" (2 documents) -> "app_customers"')));
  assert.ok(lines.some((l) => l.includes('rename "signupusers" (2 documents) -> "app_users"')));
  assert.ok(lines.some((l) => l.includes('drop "property_views" (1 documents)')));
});

test('migrate: running it again after it finished changes nothing', async () => {
  const db = fakeDb({ app_users: phone, signupusers: email });
  await migrate(db, { apply: true, log: quiet });
  await migrate(db, { apply: true, log: quiet });
  assert.deepEqual(db.cols.get('app_customers'), phone);
  assert.deepEqual(db.cols.get('app_users'), email);
});

test('migrate: finishes a half-done run where the new code already created an empty app_users', async () => {
  const db = fakeDb({ app_customers: phone, app_users: [], signupusers: email });
  await migrate(db, { apply: true, log: quiet });
  assert.deepEqual(db.cols.get('app_customers'), phone);
  assert.deepEqual(db.cols.get('app_users'), email);
  assert.ok(!db.cols.has('signupusers'));
});

test('migrate: clears an empty app_customers left by the new code, then renames', async () => {
  const db = fakeDb({ app_users: phone, app_customers: [], signupusers: email });
  await migrate(db, { apply: true, log: quiet });
  assert.deepEqual(db.cols.get('app_customers'), phone);
  assert.deepEqual(db.cols.get('app_users'), email);
});

test('migrate: refuses to overwrite a target that holds documents', async () => {
  const db = fakeDb({ app_users: phone, app_customers: [{ phone: '9000000009' }], signupusers: email });
  await assert.rejects(migrate(db, { apply: true, log: quiet }), /"app_customers" already exists with 1 documents/);
  assert.deepEqual(db.cols.get('app_users'), phone, 'nothing moved');
  assert.deepEqual(db.cols.get('signupusers'), email);
});

test('migrate: with no email accounts yet, only the phone accounts move', async () => {
  const db = fakeDb({ app_users: phone });
  await migrate(db, { apply: true, log: quiet });
  assert.deepEqual(db.cols.get('app_customers'), phone);
  assert.ok(!db.cols.has('app_users'));
});

test('models read the renamed collections', () => {
  // The real models (this file does not load the fake ones), checked without a database.
  assert.equal(require('../src/models/User').collection.name, 'app_customers');
  assert.equal(require('../src/models/Signup').collection.name, 'app_users');
});
