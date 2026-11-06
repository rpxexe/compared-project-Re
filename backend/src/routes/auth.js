const express = require("express");
const env = require("../config/env");
const Auth = require("../controllers/auth-controller");
const { rateLimit, byUser } = require("../utils/rateLimit");
const { cleanPhone, isValidPhone } = require("../utils/validate");
const { authRequired } = require("../middleware/auth");
const Signup = require("../controllers/signup-controller");

const router = express.Router();
const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many OTP requests. Please wait a few minutes.",
});
// Per number, so one attacker can't use many IPs to pump SMS to (and bill you for) a number.
const sendPerPhoneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: "Too many codes requested for this number. Please try again in an hour.",
  key: (req) => cleanPhone(req.body?.phone) || null,
});
// Whole server, so rotating both IPs and numbers (SMS pumping / toll fraud) still hits a ceiling.
// Runs last and counts only well-formed numbers, so rejected requests don't use up the budget.
const sendGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.otpGlobalHourlyLimit,
  message: "We're receiving too many sign-in requests right now. Please try again in a few minutes.",
  key: (req) => (isValidPhone(cleanPhone(req.body?.phone)) ? "otp-global" : null),
});
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: "Too many attempts. Please wait a few minutes.",
});
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

router.post("/send-otp", sendLimiter, sendPerPhoneLimiter, sendGlobalLimiter, Auth.sendOTP);
router.post("/verify-otp", verifyLimiter, Auth.verifyOTP);

// No public sign-up: developer accounts are created by an administrator (npm run create:developer).
router.post("/signin", signinIpLimiter, signinAccountLimiter, Signup.signin);

// Signs the account out on every device by invalidating all previously issued tokens.
router.post("/logout-all", authRequired, logoutAllLimiter, Auth.logoutAll);

module.exports = router;
