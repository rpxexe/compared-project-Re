require('dotenv').config();

const list = (v) => String(v || '').split(',').map((s) => s.replace(/\D/g, '').slice(-10)).filter((s) => s.length === 10);

function load() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    port: Number(process.env.PORT || 5000),
    mongoUri: process.env.MONGODB_URI || '',
    mongoFallbackUri: process.env.MONGODB_FALLBACK_URI || '',
    mongoCollection: process.env.MONGODB_COLLECTION || 'properties',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
    otpMode: (process.env.OTP_MODE || 'development').toLowerCase(),
    otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 5),
    otpResendSeconds: Number(process.env.OTP_RESEND_SECONDS || 30),
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
    twilio: {
      sid: process.env.TWILIO_ACCOUNT_SID || '',
      token: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_PHONE_NUMBER || '',
    },
    // Public origin used in uploaded image URLs (e.g. https://api.example.com); defaults to the request host.
    publicUrl: String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    corsOrigins:String(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    adminPhones: list(process.env.ADMIN_PHONES),
    superadminPhones: list(process.env.SUPERADMIN_PHONES),
    autoApprovePosts: String(process.env.AUTO_APPROVE_POSTS || 'false').toLowerCase() === 'true',
    // How often the API refreshes listings' normalised filter fields (0 turns the job off).
    filterSyncMinutes: Number(process.env.FILTER_SYNC_MINUTES ?? 10),
  };
}

const env = load();
// Re-read hook so tests can tune the environment.
env.reload = () => Object.assign(env, load());

// Secret used for JWT + OTP hashing. The fixed fallback exists only for the test suite;
// everywhere else start-up refuses to run without a real JWT_SECRET (see validate()).
env.secret = () => env.jwtSecret || (env.isTest ? 'test-only-insecure-secret' : '');

env.validate = function validate() {
  const problems = [];
  if (!env.mongoUri || /PASTE_YOUR|<password>|<user>/.test(env.mongoUri)) problems.push('MONGODB_URI is missing. Copy backend/.env.example to backend/.env and set it.');
  // Required in every environment: a missing/weak secret means anyone can forge login tokens,
  // and servers do end up exposed without NODE_ENV=production being set.
  if (!env.isTest && env.jwtSecret.length < 24) problems.push('JWT_SECRET must be a random string of at least 24 characters. Generate one with: node -e "console.log(require(`crypto`).randomBytes(32).toString(`hex`))"');
  if (env.isProd && env.otpMode !== 'twilio') problems.push('OTP_MODE must be "twilio" when NODE_ENV=production (development OTPs are returned to the client).');
  if (env.otpMode === 'twilio' && !(env.twilio.sid && env.twilio.token && env.twilio.from)) problems.push('OTP_MODE=twilio needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.');
  return problems;
};

module.exports = env;
