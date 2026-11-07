require('dotenv').config();

const lower = (v) => String(v ?? '').trim().toLowerCase();

// Only these environments may run with development conveniences (open CORS, verbose health). A missing or misspelt NODE_ENV is treated like production, never like development.
const DEV_ENVS = ['development', 'test'];

// TRUST_PROXY -> Express "trust proxy" value: a hop count ("1"), true/false, or a comma-separated
// list of addresses/subnets ("loopback, 10.0.0.0/8"). Default 1 = one reverse proxy (Render, Railway...).
function trustProxy(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return 1;
  if (/^\d+$/.test(v)) return Number(v);
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function load() {
  const nodeEnv = lower(process.env.NODE_ENV);
  const isDevLike = DEV_ENVS.includes(nodeEnv);
  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    isDevLike,
    port: Number(process.env.PORT || 5000),
    trustProxy: trustProxy(process.env.TRUST_PROXY),
    mongoUri: process.env.MONGODB_URI || '',
    mongoFallbackUri: process.env.MONGODB_FALLBACK_URI || '',
    mongoCollection: process.env.MONGODB_COLLECTION || 'properties',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
    // Public origin used in uploaded image URLs (e.g. https://api.example.com); defaults to the request host.
    publicUrl: String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    corsOrigins:String(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Firebase Authentication: phone sign-in (POST /api/v2/customers/register) and the /api/v2
    // customer endpoints. Revocation checks need admin
    // credentials: the service account (JSON, one line) or Google application default credentials.
    firebase: {
      projectId: String(process.env.FIREBASE_PROJECT_ID || '').trim(),
      serviceAccount: String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim(),
    },
    // How often the API refreshes listings' normalised filter fields (0 turns the job off).
    filterSyncMinutes: Number(process.env.FILTER_SYNC_MINUTES ?? 10),
  };
}

const env = load();
// Re-read hook so tests can tune the environment.
env.reload = () => Object.assign(env, load());

// Secret used to sign JWTs. The fixed fallback exists only for the test suite;
// everywhere else start-up refuses to run without a real JWT_SECRET (see validate()).
env.secret = () => env.jwtSecret || (env.isTest ? 'test-only-insecure-secret' : '');

env.validate = function validate() {
  const problems = [];
  if (!env.mongoUri || /PASTE_YOUR|<password>|<user>/.test(env.mongoUri)) problems.push('MONGODB_URI is missing. Copy backend/.env.example to backend/.env and set it.');
  // Required in every environment: a missing/weak secret means anyone can forge login tokens,
  // and servers do end up exposed without NODE_ENV=production being set.
  if (!env.isTest && env.jwtSecret.length < 24) problems.push('JWT_SECRET must be a random string of at least 24 characters. Generate one with: node -e "console.log(require(`crypto`).randomBytes(32).toString(`hex`))"');
  return problems;
};

module.exports = env;
