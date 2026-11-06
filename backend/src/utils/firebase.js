const env = require("../config/env");

// Verifies Firebase ID tokens for the /api/v2 customer endpoints. firebase-admin is loaded on first
// use, so the rest of the API runs without Firebase configured. Tests swap in a fake verifier.
let verifier = null;
let revoker = null;

function firebaseAuth() {
  const admin = require("firebase-admin");
  const { projectId, serviceAccount } = env.firebase;
  if (!admin.apps.length) {
    const credential = serviceAccount ? admin.credential.cert(JSON.parse(serviceAccount)) : undefined;
    admin.initializeApp({ ...(credential ? { credential } : {}), projectId: projectId || undefined });
  }
  return admin.auth();
}

// checkRevoked: tokens issued before a revokeRefreshTokens() call (sign-out everywhere, a
// password/phone change, an admin disabling the user) are rejected even though their signature
// is still valid. This needs admin credentials (FIREBASE_SERVICE_ACCOUNT).
const firebaseVerifier = () => (token) => firebaseAuth().verifyIdToken(token, true);

const isConfigured = () => Boolean(env.firebase.projectId || env.firebase.serviceAccount);

// Error codes that mean "this token is not acceptable" rather than a server-side problem.
const TOKEN_ERRORS = new Set([
  "auth/id-token-revoked", "auth/id-token-expired", "auth/user-disabled", "auth/user-not-found",
  "auth/argument-error", "auth/invalid-id-token",
]);
const isTokenError = (e) => TOKEN_ERRORS.has(e?.code || e?.errorInfo?.code);

// Resolves to the decoded token ({ uid, phone_number, email, email_verified, name, ... }) or throws.
async function verifyIdToken(token) {
  if (!verifier) {
    if (!isConfigured()) throw new Error("Firebase is not configured (set FIREBASE_PROJECT_ID)");
    verifier = firebaseVerifier();
  }
  return verifier(token);
}

// Best effort: invalidates the Firebase refresh tokens of a user (used by logout-all).
async function revokeTokens(uid) {
  if (!uid) return false;
  if (revoker) return revoker(uid);
  if (!isConfigured()) return false;
  await firebaseAuth().revokeRefreshTokens(uid);
  return true;
}

const setVerifier = (fn) => { verifier = fn; };
const setRevoker = (fn) => { revoker = fn; };

module.exports = { verifyIdToken, revokeTokens, setVerifier, setRevoker, isConfigured, isTokenError };
