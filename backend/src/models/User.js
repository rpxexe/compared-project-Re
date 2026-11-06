const mongoose = require('mongoose');

const ROLES = ['user', 'broker', 'developer', 'admin', 'superadmin'];
const PURPOSES = ['broker', 'resale', 'buyer', 'investor', 'owner', 'developer'];

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: '', trim: true, maxlength: 80 },
  role: { type: String, enum: ROLES, default: 'user', index: true },
  purpose: { type: String, enum: [...PURPOSES, ''], default: '' },
  city: { type: String, default: '', trim: true, maxlength: 80 },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  savedProperties: [{ type: mongoose.Schema.Types.Mixed }], // listing _ids as stored (ObjectId or hex string)
  compareProperties: [{ type: String }], // mobile compare list (max 4), set by PUT /api/v2/customerActivity/compare
  firebaseUid: { type: String, index: { unique: true, sparse: true } }, // linked Firebase account (/api/v2)
  // Embedded in every JWT as `v`; bumping it (POST /auth/logout-all) revokes all issued tokens.
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.models.AppUser || mongoose.model('AppUser', userSchema, 'app_users');
User.ROLES = ROLES;
User.PURPOSES = PURPOSES;
module.exports = User;
