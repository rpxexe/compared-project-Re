const { SignUpUser } = require("../models");
const { AppError } = require("../utils/errors");
const { signToken } = require("../middleware/auth");
const { hashPassword, verifyPassword, DUMMY_HASH } = require("../utils/password");
const { z, validate, EMAIL } = require("../utils/zod");

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const cleanText = (value, max = 100) =>
  String(value || "")
    .trim()
    .slice(0, max);

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

const PASSWORD_ERROR = "Password must be between 8 and 128 characters";
const signupSchema = z.object({
  fullName: z.preprocess((v) => cleanText(v, 60), z.string().min(2, { error: "Enter your full name" })),
  email: z.preprocess(normalizeEmail, z.string().regex(EMAIL, { error: "Enter a valid email address" })),
  password: z.preprocess((v) => String(v || ""), z.string().min(8, { error: PASSWORD_ERROR }).max(128, { error: PASSWORD_ERROR })),
  phone: z.preprocess((v) => cleanText(v, 20).replace(/\D/g, ""),
    z.string().refine((p) => !p || /^\d{10,15}$/.test(p), { error: "Enter a valid phone number" })),
});
// The app sends { data: { email, password } }; plain { email, password } is accepted too.
const SIGNIN_ERROR = "Enter your email and password";
const signinSchema = z.object({
  email: z.preprocess(normalizeEmail, z.string().min(1, { error: SIGNIN_ERROR })),
  password: z.preprocess((v) => String(v || ""), z.string().min(1, { error: SIGNIN_ERROR })),
});

const signup = async (req, res) => {
  const { fullName, phone, email, password } = validate(signupSchema, req.body?.data);

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
  const { email, password } = validate(signinSchema, {
    email: req.body?.data?.email || req.body?.email,
    password: req.body?.data?.password || req.body?.password,
  }, SIGNIN_ERROR);

  // Sign-in never creates accounts (that let anyone claim any email unverified); new
  // accounts go through /signup. Unknown emails still pay for a hash comparison so response
  // time and message don't reveal which emails are registered.
  const user = await SignUpUser.findOne({ email }).lean();
  const ok = await verifyPassword(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password");
  if (user.isActive === false)
    throw new AppError(403, "This account has been disabled. Contact support.");

  await SignUpUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  res.json({
    message: "Signed in successfully",
    token: signToken(user),
    user: publicSignupUser(user),
  });
};

exports.signup = signup;
exports.signin = signin;
