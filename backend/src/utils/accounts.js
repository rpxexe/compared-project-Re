// Accounts live in two collections: phone/OTP accounts (`User`, app_users) and
// email/password accounts (`SignUpUser`). Lookups check both.
const { User, SignUpUser } = require("../models");
const { publicUser } = require("./user");
const { isObjectId } = require("./validate");

const MODELS = () => [[User, "phone"], ...(SignUpUser ? [[SignUpUser, "email"]] : [])];

async function findAccount(id) {
  if (!isObjectId(String(id || ""))) return null;
  for (const [Model, accountType] of MODELS()) {
    const doc = await Model.findById(id).lean();
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

module.exports = { findAccount, accountView };
