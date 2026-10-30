// Fills / refreshes `filterFields` on every listing and creates the filter indexes.
//   npm run sync:filters            write changes + ensure indexes
//   npm run sync:filters -- --dry-run   only report how many listings would change
// The API also does this on start-up and every FILTER_SYNC_MINUTES; this is for a first run or CI.
const env = require('../src/config/env');
const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const { syncFilterFields, ensureIndexes } = require('../src/utils/filterSync');

(async () => {
  if (!env.mongoUri) { console.error('MONGODB_URI is not set in backend/.env'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();
  const t = Date.now();
  const s = await syncFilterFields({ dryRun });
  console.log(`${dryRun ? '[dry run] would update' : 'Updated'} ${s.changed} of ${s.scanned} listings in ${Date.now() - t} ms`);
  if (!dryRun) {
    await ensureIndexes();
    console.log('Filter indexes are in place.');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error('Sync failed:', e.message); process.exit(1); });
