import { Platform } from "react-native";

// Firebase phone sign-in (React Native Firebase). The native module only exists in development /
// release builds made after it was added: Expo Go, the web build and older installs don't have
// it, so `available()` is false there and the app keeps using the backend's own OTP.
let fb = null;
if (Platform.OS !== "web") {
  try {
    fb = require("@react-native-firebase/auth");
  } catch {
    fb = null;
  }
}

let authInstance;
function auth() {
  if (authInstance === undefined) {
    try {
      authInstance = fb ? fb.getAuth() : null;
    } catch {
      authInstance = null; // native module missing (e.g. Expo Go)
    }
  }
  return authInstance;
}

export const available = () => !!auth();

// The code sent by the last sendCode(); kept here because it can't travel in navigation params.
let confirmation = null;

export async function sendCode(phone10) {
  confirmation = await fb.signInWithPhoneNumber(auth(), `+91${phone10}`);
}

export async function confirmCode(code) {
  if (!confirmation) throw Object.assign(new Error("Please request a new code."), { code: "auth/session-expired" });
  const result = await confirmation.confirm(code);
  confirmation = null;
  return result?.user || auth().currentUser;
}

// Android can verify the SMS by itself and sign in without the code being typed.
export function onSignedIn(callback) {
  const a = auth();
  if (!a) return () => {};
  return fb.onAuthStateChanged(a, (user) => {
    if (user) callback(user);
  });
}

export const signedIn = () => !!auth()?.currentUser;
export const currentPhone = () => auth()?.currentUser?.phoneNumber || null;

// A fresh-enough ID token for /api/v2 (the SDK refreshes it); null when not signed in.
export async function idToken(force = false) {
  const user = auth()?.currentUser;
  return user ? fb.getIdToken(user, force) : null;
}

export async function signOut() {
  const a = auth();
  if (a?.currentUser) await fb.signOut(a).catch(() => {});
  confirmation = null;
}

const MESSAGES = {
  "auth/invalid-verification-code": "Incorrect OTP. Please check and try again.",
  "auth/code-expired": "This OTP has expired. Please request a new one.",
  "auth/session-expired": "This OTP has expired. Please request a new one.",
  "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
  "auth/quota-exceeded": "We can't send more codes right now. Please try again later.",
  "auth/invalid-phone-number": "Enter a valid 10-digit Indian mobile number.",
  "auth/network-request-failed": "Cannot reach the server. Check your internet connection.",
  // Phone sign-in disabled, or India not allowed in Authentication > Settings > SMS region policy.
  "auth/operation-not-allowed": "Phone sign-in isn't available right now. Please try again later.",
  "auth/app-not-authorized":"This app build isn't set up for phone sign-in yet (check the SHA keys in Firebase).",
  "auth/missing-client-identifier": "This app build isn't set up for phone sign-in yet (check the SHA keys in Firebase).",
};

export function friendlyError(e) {
  return MESSAGES[e?.code] || e?.message || "Something went wrong. Please try again.";
}

// Codes after which typing the same code again can't work.
export const needsNewCode = (e) => ["auth/code-expired", "auth/session-expired"].includes(e?.code);
