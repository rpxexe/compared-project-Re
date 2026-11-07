const mongoose = require("mongoose");

const ROLES = ["user", "broker", "developer", "admin", "superadmin"];
const PURPOSES = ["broker", "resale", "buyer", "investor", "owner", "developer"];

const signUpUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, default: "", trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, default: "user" },
    email: { type: String, unique: true },
    password: { type: String, default: "", trim: true, maxlength: 256 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    savedProperties: [{ type: mongoose.Schema.Types.Mixed }], // listing _ids as stored (ObjectId or hex string)
    compareProperties: [{ type: String }], // mobile compare list (max 4), set by PUT /api/v2/customerActivity/compare
    firebaseUid: { type: String, index: { unique: true, sparse: true } }, // linked Firebase account (/api/v2)
    // Embedded in every JWT as `v`; bumping it (POST /auth/logout-all) revokes all issued tokens.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Email/password accounts (developers, CRM staff). Collection renamed from `signupusers` to
// `app_users` (npm run migrate:collections).
const SignUpUser =
  mongoose.models.SignUpUser || mongoose.model("SignUpUser", signUpUserSchema, "app_users");
SignUpUser.ROLES = ROLES;
SignUpUser.PURPOSES = PURPOSES;
module.exports = SignUpUser;
