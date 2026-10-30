// Keeps `filterFields` (see filterFields.js) in step with the source fields. The collection is
// shared with the website/scraper, which can insert or rewrite listings at any time, so the API
// re-checks every listing on start-up and then on an interval, writing only real changes.
const { Property } = require('../models');
const { FIELD, compute, sameFields } = require('./filterFields');

// Source fields compute() reads, so the scan never pulls descriptions, galleries of text etc.
const SOURCE = [
  'listingType', 'propertyType', 'type', 'propertyGroup', 'category', 'city', 'location.city',
  'price', 'amount', 'maxPrice', 'bhk', 'bedrooms', 'bedroom', 'bathrooms', 'bathroom',
  'area', 'superBuiltUpArea', 'builtUpArea', 'furnishing', 'possessionStatus', 'possession',
  'availability', 'status', 'dataSource', 'ownerRole', 'developerName', 'builderName',
  'ageOfProperty', 'floor', 'facing', 'amenities', 'facilities', 'coverImage', 'galleryImages',
  'images', 'image', 'reraApproved', 'reraNumber', 'reraNo', 'verified', 'createdAt', 'postedAt',
  'updatedAt', FIELD,
].join(' ');

// Index keys follow equality -> sort -> range: every filtered search pins deal + segment, then
// sorts by date or price; bedroom counts are the most common extra equality.
const INDEXES = [
  { [`${FIELD}.deal`]: 1, [`${FIELD}.segment`]: 1, [`${FIELD}.postedAt`]: -1 },
  { [`${FIELD}.deal`]: 1, [`${FIELD}.segment`]: 1, [`${FIELD}.price`]: 1 },
  { [`${FIELD}.deal`]: 1, [`${FIELD}.segment`]: 1, [`${FIELD}.bhk`]: 1, [`${FIELD}.price`]: 1 },
];

async function ensureIndexes() {
  for (const key of INDEXES) await Property.collection.createIndex(key, { background: true });
}

async function syncFilterFields({ dryRun = false, batchSize = 500 } = {}) {
  const stats = { scanned: 0, changed: 0 };
  let ops = [];
  const flush = async () => {
    // Native driver on purpose: most imported ids are hex *strings*, which Mongoose would try
    // (and fail) to cast to ObjectId, silently skipping those listings.
    if (ops.length && !dryRun) await Property.collection.bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const doc of Property.find({}).select(SOURCE).lean().cursor()) {
    stats.scanned += 1;
    const next = compute(doc);
    if (sameFields(doc[FIELD], next)) continue;
    stats.changed += 1;
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { [FIELD]: next } } } });
    if (ops.length >= batchSize) await flush();
  }
  await flush();
  return stats;
}

// Runs once now and then every `minutes`. Failures are logged, never thrown: search keeps
// working on the last synced values.
function startFilterSync(minutes) {
  if (!(minutes > 0)) return () => {};
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const s = await syncFilterFields();
      if (s.changed) console.log(`[filters] synced ${s.changed} of ${s.scanned} listings`);
    } catch (e) {
      console.error('[filters] sync failed:', e.message);
    } finally {
      running = false;
    }
  };
  ensureIndexes().catch((e) => console.error('[filters] index creation failed:', e.message));
  run();
  const timer = setInterval(run, minutes * 60000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { syncFilterFields, ensureIndexes, startFilterSync, INDEXES };
