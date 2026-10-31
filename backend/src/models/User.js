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
}, { timestamps: true });

const User = mongoose.models.AppUser || mongoose.model('AppUser', userSchema, 'app_users');
User.ROLES = ROLES;
User.PURPOSES = PURPOSES;
module.exports = User;
