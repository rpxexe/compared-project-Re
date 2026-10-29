// Read-only connectivity check against YOUR MongoDB:  npm run check:db
// Prints how many property documents exist and which field names they use.
const env = require('../src/config/env');
const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');

(async () => {
  if (!env.mongoUri) { console.error('MONGODB_URI is not set in backend/.env'); process.exit(1); }
  await connectDb();
  const col = mongoose.connection.db.collection(env.mongoCollection);
  const total = await col.countDocuments();
  console.log(`Connected to database "${mongoose.connection.name}". Collection "${env.mongoCollection}" has ${total} documents.`);
  const sample = await col.find({}).limit(200).toArray();
  const freq = {};
  for (const d of sample) for (const k of Object.keys(d)) freq[k] = (freq[k] || 0) + 1;
  const rows = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.padEnd(28)} ${n}/${sample.length}`);
  console.log('\nField usage in the first documents:\n' + rows.join('\n'));
  await mongoose.disconnect();
})().catch((e) => { console.error('Connection failed:', e.message); process.exit(1); });
