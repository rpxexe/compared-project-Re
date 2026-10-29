const dns = require('node:dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore if not supported
}

const mongoose = require('mongoose');
const env = require('./env');


async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    return mongoose.connection;
  } catch (err) {
    const isDnsError =
      err?.message?.includes('querySrv') ||
      err?.message?.includes('ESERVFAIL') ||
      err?.message?.includes('ENOTFOUND');
    // Optional non-SRV connection string for networks whose DNS can't resolve SRV records.
    // Lives in .env (never in source control) and must point at the SAME cluster/database.
    if (isDnsError && env.mongoUri.startsWith('mongodb+srv://') && env.mongoFallbackUri) {
      console.warn('[MongoDB] SRV lookup failed on local DNS. Retrying with MONGODB_FALLBACK_URI...');
      await mongoose.connect(env.mongoFallbackUri, { serverSelectionTimeoutMS: 10000 });
      return mongoose.connection;
    }
    throw err;
  }
}

module.exports = { connectDb };
