const express = require("express");
const env = require("../config/env");
const { Otp, User } = require("../models");
const { signToken } = require("../middleware/auth");
const { AppError, bad } = require("../utils/errors");
const { cleanPhone, isValidPhone, str } = require("../utils/validate");
const { generateOtp, hashOtp, otpMatches } = require("../utils/otp");
const { sendSms } = require("../utils/sms");
const { rateLimit } = require("../utils/rateLimit");
const { publicUser } = require("../utils/user");

// const router = express.Router();
const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many OTP requests. Please wait a few minutes.",
});
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: "Too many attempts. Please wait a few minutes.",
});

const sendOTP = async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  if (!isValidPhone(phone))
    throw bad("Enter a valid 10-digit Indian mobile number");

  const existing = await Otp.findOne({ phone }).lean();
  if (existing) {
    const wait = Math.ceil(
      (new Date(existing.lastSentAt).getTime() +
        env.otpResendSeconds * 1000 -
        Date.now()) /
        1000,
    );
    if (wait > 0)
      throw new AppError(
        429,
        `Please wait ${wait}s before requesting another OTP`,
        { retryAfterSeconds: wait },
      );
  }

  const otp = generateOtp();
  const now = Date.now();
  await Otp.deleteMany({ phone });
  await Otp.create({
    phone,
    codeHash: hashOtp(phone, otp),
    expiresAt: new Date(now + env.otpTtlMinutes * 60000),
    attempts: 0,
    lastSentAt: new Date(now),
  });

  const body = {
    message: "OTP sent successfully",
    expiresInSeconds: env.otpTtlMinutes * 60,
    resendInSeconds: env.otpResendSeconds,
    mode: env.otpMode,
  };
  if (env.otpMode === "twilio") {
    try {
      await sendSms(
        phone,
        `Your Compare Project verification code is ${otp}. It is valid for ${env.otpTtlMinutes} minutes.`,
      );
    } catch (e) {
      await Otp.deleteMany({ phone });
      throw e;
    }
  } else {
    body.devOtp = otp; // development only – production start-up refuses OTP_MODE=development
    if (!env.isTest) console.log(`[dev OTP] +91${phone}: ${otp}`);
  }
  res.json(body);
};

const verifyOTP = async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  const otp = str(req.body?.otp, 6);
  if (!isValidPhone(phone))
    throw bad("Enter a valid 10-digit Indian mobile number");
  if (!/^\d{6}$/.test(otp)) throw bad("Enter the 6-digit OTP");

  const record = await Otp.findOne({ phone }).lean();
  if (!record)
    throw new AppError(
      401,
      "OTP not found or already used. Please request a new one.",
    );
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await Otp.deleteMany({ phone });
    throw new AppError(401, "This OTP has expired. Please request a new one.", {
      code: "OTP_EXPIRED",
    });
  }
  if ((record.attempts || 0) >= env.otpMaxAttempts) {
    await Otp.deleteMany({ phone });
    throw new AppError(
      429,
      "Too many wrong attempts. Please request a new OTP.",
      { code: "OTP_LOCKED" },
    );
  }
  if (!otpMatches(record, phone, otp)) {
    await Otp.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw new AppError(401, "Incorrect OTP. Please check and try again.", {
      code: "OTP_INVALID",
    });
  }
  await Otp.deleteMany({ phone });

  // Admin bootstrap: numbers listed in env are elevated after proving ownership with an OTP.
  const elevated = env.superadminPhones.includes(phone)
    ? "superadmin"
    : env.adminPhones.includes(phone)
      ? "admin"
      : null;
  let user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone }, $set: { lastLoginAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  if (user.isActive === false)
    throw new AppError(403, "This account has been disabled. Contact support.");
  if (elevated && user.role !== elevated && user.role !== "superadmin") {
    user = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { role: elevated } },
      { new: true },
    ).lean();
  }
  res.json({
    token: signToken(user),
    user: publicUser(user),
    isNewUser: !user.purpose,
  });
};

exports.sendOTP = sendOTP;
exports.verifyOTP = verifyOTP;
