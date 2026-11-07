// One-off collection migration for YOUR MongoDB:
//   npm run migrate:collections            -> shows what would change, changes nothing
//   npm run migrate:collections -- --apply -> does it
//
//   1. app_users   -> app_customers   (phone/OTP customer accounts)
//   2. signupusers -> app_users       (email/password accounts: developers, CRM staff)
//   3. drops property_views           (view tracking was removed)
//
// The order matters: app_users must be moved out of the way before signupusers can take its name.
// Stop the API (and anything else writing to these collections, such as the CRM) first, run this,
// then deploy the new code. Renames keep every document and index. Safe to re-run: finished steps
// are skipped, and a collection that holds documents is never overwritten.

// `db` is a MongoDB driver Db. With apply false nothing is written; the plan is only printed.
async function migrate(db, { apply = false, log = console.log } = {}) {
  // Document counts per collection as the plan goes along. A dry run updates this map instead of
  // the database, so later steps see the state the earlier ones would leave behind.
  const state = new Map();
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray())
    state.set(name, await db.collection(name).countDocuments());
  const has = (name) => state.has(name);
  const size = (name) => state.get(name) || 0;
  // Email accounts carry a password hash; phone accounts never do.
  const looksLikeEmailAccounts = async (name) =>
    (await db.collection(name).countDocuments({ password: { $exists: true, $nin: ['', null] } })) > 0;

  async function drop(name, why) {
    log(`  - drop "${name}" (${size(name)} documents)${why ? `: ${why}` : ''}`);
    if (apply) await db.collection(name).drop();
    state.delete(name);
  }

  async function rename(from, to) {
    if (has(to)) {
      // An empty target is usually one the new code created on start-up; anything else is data.
      if (size(to) > 0) throw new Error(`"${to}" already exists with ${size(to)} documents. Refusing to overwrite it; resolve this by hand.`);
      await drop(to, 'empty, so it is cleared first');
    }
    log(`  - rename "${from}" (${size(from)} documents) -> "${to}"`);
    if (apply) await db.collection(from).rename(to);
    state.set(to, size(from));
    state.delete(from);
  }

  log('1. Phone accounts: app_users -> app_customers');
  if (!has('app_users')) log('  - nothing to do ("app_users" does not exist)');
  else if (size('app_users') === 0) log('  - nothing to move ("app_users" is empty)');
  else if (!has('signupusers') && (has('app_customers') || (await looksLikeEmailAccounts('app_users'))))
    log('  - already done ("app_users" holds the email accounts)');
  else await rename('app_users', 'app_customers');

  log('2. Email accounts: signupusers -> app_users');
  if (!has('signupusers')) log('  - nothing to do ("signupusers" does not exist)');
  else await rename('signupusers', 'app_users');

  log('3. Remove view tracking');
  if (!has('property_views')) log('  - nothing to do ("property_views" does not exist)');
  else await drop('property_views');
}

module.exports = { migrate };

if (require.main === module) {
  const env = require('../src/config/env');
  const mongoose = require('mongoose');
  const { connectDb } = require('../src/config/db');
  const apply = process.argv.includes('--apply');

  (async () => {
    if (!env.mongoUri) { console.error('MONGODB_URI is not set in backend/.env'); process.exit(1); }
    await connectDb();
    console.log(`Database "${mongoose.connection.name}"${apply ? '' : ' (dry run: add -- --apply to make these changes)'}\n`);
    await migrate(mongoose.connection.db, { apply });
    console.log(apply ? '\nDone.' : '\nDry run only. Nothing was changed.');
    await mongoose.disconnect();
  })().catch(async (e) => {
    console.error('\nMigration stopped:', e.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
