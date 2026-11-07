const express = require("express");
const Auth = require("../controllers/auth-controller");
const { rateLimit, byUser } = require("../utils/rateLimit");
const { authRequired } = require("../middleware/auth");
const Signup = require("../controllers/signup-controller");

const router = express.Router();
// Password endpoints: slow down credential stuffing / brute force by IP and by account.
const emailKey = (req) =>
  String(req.body?.data?.email || req.body?.email || "").trim().toLowerCase().slice(0, 254) || null;
const signinIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many sign-in attempts. Please wait a few minutes.",
});
const signinAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many sign-in attempts for this account. Please wait 15 minutes.",
  key: emailKey,
});
const logoutAllLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: byUser });

// Phone sign-in: Firebase Authentication in the app, then POST /api/v2/customers/register.

// No public sign-up: developer accounts are created by an administrator (npm run create:developer).
router.post("/signin", signinIpLimiter, signinAccountLimiter, Signup.signin);

// Signs the account out on every device by invalidating all previously issued tokens.
router.post("/logout-all", authRequired, logoutAllLimiter, Auth.logoutAll);

module.exports = router;
