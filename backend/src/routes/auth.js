const express = require("express");
const Auth = require("../controllers/auth-controller");
const { rateLimit } = require("../utils/rateLimit");
const { cleanPhone } = require("../utils/validate");
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
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many sign-ups from this network. Please try again later.",
});

router.post("/send-otp", sendLimiter, sendPerPhoneLimiter, Auth.sendOTP);
router.post("/verify-otp", verifyLimiter, Auth.verifyOTP);

router.post("/signup", signupLimiter, Signup.signup);
router.post("/signin", signinIpLimiter, signinAccountLimiter, Signup.signin);

module.exports = router;
