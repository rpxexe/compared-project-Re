const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { SignUpUser } = require("../models");
const { AppError, bad } = require("../utils/errors");
const { signToken } = require("../middleware/auth");

const scrypt = promisify(crypto.scrypt);
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const cleanText = (value, max = 100) =>
  String(value || "")
    .trim()
    .slice(0, max);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = stored.split(":");
  const expected = Buffer.from(expectedHex || "", "hex");
  const actual = await scrypt(password, salt, 64);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
// Valid-format hash of a random throwaway password, compared against for unknown emails.
const DUMMY_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

function publicSignupUser(user) {
  return {
    id: String(user._id),
    name: user.fullName || "",
    fullName: user.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
    role: user.role || "user",
    purpose: user.purpose || "owner",
    city: user.city || "Mumbai",
  };
}

const signup = async (req, res) => {
  const fullName = cleanText(req.body?.data?.fullName, 60);
  const phone = cleanText(req.body?.data?.phone, 20).replace(/\D/g, "");
  const email = normalizeEmail(req.body?.data?.email);
  const password = String(req.body?.data?.password || "");

  if (parseInt(fullName.length) < 2) throw bad("Enter your full name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw bad("Enter a valid email address");
  if (password.length < 8 || password.length > 128)
    throw bad("Password must be between 8 and 128 characters");
  if (phone && !/^\d{10,15}$/.test(phone))
    throw bad("Enter a valid phone number");

  const existing = await SignUpUser.findOne({ email }).lean();
  if (existing)
    throw new AppError(
      409,
      "An account with this email already exists. Please sign in.",
    );

  const passwordHash = await hashPassword(password);
  const user = await SignUpUser.create({
    fullName,
    phone,
    email,
    password: passwordHash,
    role: "user",
    isActive: true,
  });
  res.status(201).json({
    message: "Account created successfully",
    token: signToken(user),
    user: publicSignupUser(user),
  });
};

const signin = async (req, res) => {
  const email = normalizeEmail(req.body?.data?.email || req.body?.email);
  const password = String(req.body?.data?.password || req.body?.password || "");
  if (!email || !password) throw bad("Enter your email and password");

  // Sign-in never creates accounts (that let anyone claim any email unverified); new
  // accounts go through /signup. Unknown emails still pay for a hash comparison so response
  // time and message don't reveal which emails are registered.
  const user = await SignUpUser.findOne({ email });
  const ok = await verifyPassword(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password");
  if (user.isActive === false)
    throw new AppError(403, "This account has been disabled. Contact support.");

  user.lastLoginAt = new Date();
  await user.save();
  res.json({
    message: "Signed in successfully",
    token: signToken(user),
    user: publicSignupUser(user),
  });
};

exports.signup = signup;
exports.signin = signin;
