// Email/password sign-in for developer accounts. There is no public sign-up: developer accounts
// are created by an administrator with `npm run create:developer` (scripts/create-developer.js).
const { SignUpUser } = require("../models");
const { AppError } = require("../utils/errors");
const { signToken } = require("../middleware/auth");
const { verifyPassword, DUMMY_HASH, PASSWORD_MAX } = require("../utils/password");
const { z, validate, email } = require("../utils/zod");

function publicSignupUser(user) {
  return {
    id: String(user._id),
    name: user.fullName || "",
    fullName: user.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
    role: user.role || "user",
    purpose: user.purpose || (user.role === "developer" ? "developer" : "owner"),
    city: user.city || "Mumbai",
  };
}

// The app sends { data: { email, password } }; plain { email, password } is accepted too.
// Both fields are length-capped before any regex or password hashing runs.
const SIGNIN_ERROR = "Enter your email and password";
const signinSchema = z.object({
  email: email(SIGNIN_ERROR),
  password: z.string({ error: SIGNIN_ERROR }).min(1, { error: SIGNIN_ERROR }).max(PASSWORD_MAX, { error: SIGNIN_ERROR }),
});

const signin = async (req, res) => {
  const { email: address, password } = validate(signinSchema, {
    email: req.body?.data?.email || req.body?.email,
    password: req.body?.data?.password || req.body?.password,
  }, SIGNIN_ERROR);

  // Sign-in never creates accounts. Unknown emails still pay for a hash comparison so response
  // time and message don't reveal which emails are registered.
  const user = await SignUpUser.findOne({ email: address }).lean();
  const ok = await verifyPassword(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password");
  if (user.isActive === false)
    throw new AppError(403, "This account has been disabled. Contact support.");

  // Email/password is the app's developer sign-in (customers use Firebase phone sign-in), so accounts created
  // before developers had their own role become developers; staff roles are left alone.
  const set = { lastLoginAt: new Date() };
  if (!user.role || user.role === "user") set.role = "developer";
  await SignUpUser.updateOne({ _id: user._id }, { $set: set });
  res.json({
    message: "Signed in successfully",
    token: signToken(user),
    user: publicSignupUser({ ...user, ...set }),
  });
};

exports.signin = signin;
