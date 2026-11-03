// Customers and staff live in two collections: phone/OTP accounts (`User`, app_users) and
// email/password accounts (`SignUpUser`). CRM lookups always check both.
const mongoose = require("mongoose");
const { User, SignUpUser } = require("../models");
const { publicUser } = require("./user");
const { isObjectId } = require("./validate");

const STAFF_ROLES = ["admin", "superadmin"];
const MODELS = () => [[User, "phone"], ...(SignUpUser ? [[SignUpUser, "email"]] : [])];

async function findAccount(id) {
  if (!isObjectId(String(id || ""))) return null;
  for (const [Model, accountType] of MODELS()) {
    const doc = await Model.findById(id).lean();
    if (doc) return { doc, Model, accountType };
  }
  return null;
}

// First account (either collection) with this phone number.
async function findAccountByPhone(phone) {
  for (const [Model, accountType] of MODELS()) {
    const doc = await Model.findOne({ phone }).lean();
    if (doc) return { doc, Model, accountType };
  }
  return null;
}

const accountView = (doc, accountType) => ({
  ...publicUser(doc),
  accountType,
  isActive: doc.isActive !== false,
  createdAt: doc.createdAt || null,
  lastLoginAt: doc.lastLoginAt || null,
});

// Staff accounts from both collections; `filter` is added to the role condition.
async function findStaff(filter = {}) {
  const out = [];
  for (const [Model, accountType] of MODELS()) {
    const docs = await Model.find({ role: { $in: STAFF_ROLES }, ...filter }).sort({ createdAt: 1, _id: 1 }).lean();
    docs.forEach((doc) => out.push({ doc, Model, accountType }));
  }
  return out;
}

const ACTIVE = { isActive: { $ne: false } };
const activeStaffIds = async () => (await findStaff(ACTIVE)).map((s) => String(s.doc._id));
const activeSuperadminIds = async () => (await findStaff({ ...ACTIVE, role: "superadmin" })).map((s) => String(s.doc._id));

async function findActiveStaff(id) {
  const a = await findAccount(id);
  return a && STAFF_ROLES.includes(a.doc.role) && a.doc.isActive !== false ? a : null;
}

// id -> display name for a set of account ids (unknown ids are left out).
async function namesById(ids) {
  const wanted = [...new Set(ids.filter(Boolean).map(String))].filter(isObjectId);
  const names = new Map();
  if (!wanted.length) return names;
  const oids = wanted.map((id) => new mongoose.Types.ObjectId(id));
  for (const [Model] of MODELS()) {
    const docs = await Model.find({ _id: { $in: oids } }).select("name fullName phone").lean();
    docs.forEach((d) => names.set(String(d._id), d.name || d.fullName || d.phone || ""));
  }
  return names;
}

module.exports = {
  STAFF_ROLES, MODELS, findAccount, findAccountByPhone, accountView, findStaff,
  activeStaffIds, activeSuperadminIds, findActiveStaff, namesById,
};
