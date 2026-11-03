const env = require("../config/env");

// Verifies Firebase ID tokens for the /api/v2 customer endpoints. firebase-admin is loaded on first
// use, so the rest of the API runs without Firebase configured. Tests swap in a fake verifier.
let verifier = null;

function firebaseVerifier() {
  const admin = require("firebase-admin");
  const { projectId, serviceAccount } = env.firebase;
  if (!admin.apps.length) {
    const credential = serviceAccount ? admin.credential.cert(JSON.parse(serviceAccount)) : undefined;
    admin.initializeApp({ ...(credential ? { credential } : {}), projectId: projectId || undefined });
  }
  return (token) => admin.auth().verifyIdToken(token);
}

const isConfigured = () => Boolean(env.firebase.projectId || env.firebase.serviceAccount);

// Resolves to the decoded token ({ uid, phone_number, email, email_verified, name, ... }) or throws.
async function verifyIdToken(token) {
  if (!verifier) {
    if (!isConfigured()) throw new Error("Firebase is not configured (set FIREBASE_PROJECT_ID)");
    verifier = firebaseVerifier();
  }
  return verifier(token);
}

const setVerifier = (fn) => { verifier = fn; };

module.exports = { verifyIdToken, setVerifier, isConfigured };
