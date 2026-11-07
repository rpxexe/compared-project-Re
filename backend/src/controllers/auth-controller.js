const env = require("../config/env");
const { Otp, User } = require("../models");
const { signToken, findAccountById } = require("../middleware/auth");
const { AppError } = require("../utils/errors");
const { str } = require("../utils/validate");
const { generateOtp, hashOtp, otpMatches } = require("../utils/otp");
const { sendSms } = require("../utils/sms");
const { revokeTokens } = require("../utils/firebase");
const { publicUser } = require("../utils/user");
const { z, validate, phone: phoneField } = require("../utils/zod");

const PHONE_ERROR = "Enter a valid 10-digit Indian mobile number";
const sendSchema = z.object({ phone: phoneField(PHONE_ERROR) });
const verifySchema = sendSchema.extend({
  otp: z.preprocess((v) => str(v, 6), z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit OTP" })),
});

const sendOTP = async (req, res) => {
  const { phone } = validate(sendSchema, req.body);

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
  const created = await Otp.create({
    phone,
    codeHash: hashOtp(phone, otp),
    expiresAt: new Date(now + env.otpTtlMinutes * 60000),
    attempts: 0,
    lastSentAt: new Date(now),
  });
  // Parallel sends can both pass the cooldown check above; keep only the newest code so a
  // number never has several live codes (each with its own attempt budget) at once.
  await Otp.deleteMany({ phone, _id: { $ne: created._id }, lastSentAt: { $lte: created.lastSentAt } });

  const body = {
    message: "OTP sent successfully",
    expiresInSeconds: env.otpTtlMinutes * 60,
    resendInSeconds: env.otpResendSeconds,
    mode: env.otpMode,
  };
  if (env.devOtpEnabled()) {
    // Development/test only (start-up refuses OTP_MODE=development anywhere else). The code is
    // returned to the client and never logged.
    body.devOtp = otp;
  } else {
    try {
      await sendSms(
        phone,
        `Your Compare Project verification code is ${otp}. It is valid for ${env.otpTtlMinutes} minutes.`,
      );
    } catch (e) {
      await Otp.deleteMany({ phone });
      throw e;
    }
  }
  res.json(body);
};

// Why an attempt could not be reserved: no code, an expired one, or one that is locked.
async function rejectAttempt(phone, now) {
  const record = await Otp.findOne({ phone }).lean();
  if (!record)
    throw new AppError(401, "OTP not found or already used. Please request a new one.");
  if (new Date(record.expiresAt).getTime() <= now) {
    await Otp.deleteMany({ phone });
    throw new AppError(401, "This OTP has expired. Please request a new one.", { code: "OTP_EXPIRED" });
  }
  await Otp.deleteMany({ phone });
  throw new AppError(429, "Too many wrong attempts. Please request a new OTP.", { code: "OTP_LOCKED" });
}

const verifyOTP = async (req, res) => {
  const { phone, otp } = validate(verifySchema, req.body);
  const now = Date.now();

  // Reserve one attempt atomically BEFORE comparing the code: the increment only happens while
  // attempts are below the limit, so parallel guesses can never get more than otpMaxAttempts
  // comparisons out of one code (a read-then-increment would let them all pass the check).
  const record = await Otp.findOneAndUpdate(
    { phone, attempts: { $lt: env.otpMaxAttempts }, expiresAt: { $gt: new Date(now) } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();
  if (!record) await rejectAttempt(phone, now);

  if (!otpMatches(record, phone, otp))
    throw new AppError(401, "Incorrect OTP. Please check and try again.", { code: "OTP_INVALID" });
  // Single use: only the request that actually deletes the code may sign in.
  const used = await Otp.deleteOne({ _id: record._id });
  if (!used.deletedCount)
    throw new AppError(401, "OTP not found or already used. Please request a new one.");
  await Otp.deleteMany({ phone });

  // Phone logins never change a role: staff and user management live in the separate CRM.
  const user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone }, $set: { lastLoginAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  if (user.isActive === false)
    throw new AppError(403, "This account has been disabled. Contact support.");
  res.json({
    token: signToken(user),
    user: publicUser(user),
    isNewUser: !user.purpose,
  });
};

// POST /auth/logout-all: bumps the account's token version, so every JWT issued so far (on this
// and every other device) stops working, and revokes the linked Firebase session if there is one.
const logoutAll = async (req, res) => {
  const found = await findAccountById(req.user.id);
  if (!found) throw new AppError(401, "Account not available. Please log in again.");
  await found.Model.updateOne({ _id: found.user._id }, { $inc: { tokenVersion: 1 } });
  if (found.user.firebaseUid) {
    try {
      await revokeTokens(found.user.firebaseUid);
    } catch (e) {
      if (!env.isTest) console.error(`Firebase token revocation failed: ${e?.code || "unknown error"}`);
    }
  }
  res.json({ ok: true, message: "Signed out on all devices" });
};

exports.sendOTP = sendOTP;
exports.verifyOTP = verifyOTP;
exports.logoutAll = logoutAll;
