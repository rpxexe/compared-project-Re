const env = require("../config/env");
const { User, SignUpUser } = require("../models");
const { verifyIdToken } = require("../utils/firebase");

// Customer auth for /api/v2 (see MOBILE_API.md). Every failure is a 401 with a bare { message },
// exactly as in the mobile API contract: "No token", "Invalid token" or "Customer not found".
const deny = (res, message) => res.status(401).json({ message });

// The decoded token, or null after sending the 401.
async function decode(req, res) {
  const header = String(req.headers.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    deny(res, "No token");
    return null;
  }
  try {
    return await verifyIdToken(token);
  } catch (e) {
    if (!env.isTest && /not configured/.test(e.message)) console.error(e.message);
    deny(res, "Invalid token");
    return null;
  }
}

// The customer account linked to a Firebase uid, in either account collection.
async function findCustomer(uid) {
  for (const [Model, accountType] of [[User, "phone"], [SignUpUser, "email"]]) {
    if (!Model) continue;
    const doc = await Model.findOne({ firebaseUid: uid }).lean();
    if (doc) return { doc, Model, accountType };
  }
  return null;
}

// Valid token only (used to create the customer account).
async function firebaseToken(req, res, next) {
  const decoded = await decode(req, res);
  if (!decoded) return;
  req.firebase = decoded;
  next();
}

// Valid token AND an active customer account linked to it.
async function firebaseCustomer(req, res, next) {
  const decoded = await decode(req, res);
  if (!decoded) return;
  const customer = await findCustomer(decoded.uid);
  if (!customer || customer.doc.isActive === false) return deny(res, "Customer not found");
  req.firebase = decoded;
  req.customer = customer;
  // Same shape as the JWT middleware's req.user, so shared helpers (CRM lead hooks) work unchanged.
  req.user = {
    id: String(customer.doc._id),
    phone: customer.doc.phone || "",
    name: customer.doc.name || customer.doc.fullName || "",
    role: customer.doc.role || "user",
  };
  next();
}

module.exports = { firebaseToken, firebaseCustomer, findCustomer };
