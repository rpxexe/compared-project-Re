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
    savedProperties: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { timestamps: true },
);

const SignUpUser =
  mongoose.models.SignUpUser || mongoose.model("SignUpUser", signUpUserSchema);
SignUpUser.ROLES = ROLES;
SignUpUser.PURPOSES = PURPOSES;
module.exports = SignUpUser;
