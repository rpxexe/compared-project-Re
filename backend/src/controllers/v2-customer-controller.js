// Firebase-authenticated customer endpoints of the mobile API contract (see MOBILE_API.md):
// account registration, hearts (saved properties) and the server-side compare list. Errors are
// a bare { message }, as in the contract. Hearts share `savedProperties` with the v1 app's saves.
const { User, SignUpUser, Property } = require("../models");
const { str, isPropertyId, propertyIdValues, propertyIdMatch, cleanPhone, isValidPhone } = require("../utils/validate");
const { PUBLIC } = require("../utils/propertyQuery");
const { toCard } = require("../utils/contractProperty");
const { accountView } = require("../utils/accounts");
const { findCustomer } = require("../middleware/firebaseAuth");
const { signToken } = require("../middleware/auth");
const { publicUser } = require("../utils/user");
const { z } = require("zod");

const compareSchema = z.object({ propertyIds: z.array(z.unknown()) });
const registerSchema = z.object({ name: z.preprocess((v) => str(v, 80), z.string()).optional() }).catch({});

const MAX_HEARTS = 200;
const MAX_COMPARE = 4;
const intIn = (v, def, min, max) => {
  const n = parseInt(str(v, 6), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// Activity cards for ids, in the order given; ids of missing or hidden listings are skipped.
async function cardsFor(ids) {
  if (!ids.length) return [];
  const docs = await Property.find({ $and: [PUBLIC, { _id: { $in: ids.flatMap(propertyIdValues) } }] }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean).map((d) => toCard(d, "activity"));
}

// ----- Registration -------------------------------------------------------------------------
// The registration response. `token` + `user` are the v1 session,
// so an app that signs in with Firebase can keep calling the v1 routes too.
async function signedIn(res, status, Model, doc, created) {
  await Model.updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } });
  res.status(status).json({
    success: true,
    created,
    customer: accountView(doc, Model === User ? "phone" : "email"),
    token: signToken(doc),
    user: publicUser(doc),
    isNewUser: !doc.purpose,
  });
}

// Links the Firebase user to a customer account, creating one if needed.
//
// The ONLY identity an existing account is linked by is a Firebase-verified phone number matching
// a phone (OTP) account: both sides proved ownership of that number. Email is never used to link -
// an email/password account's address was never verified, so linking by it would let whoever
// pre-registered an address take over (or be handed) the Firebase user's account. A sign-in with
// no matching phone account gets a NEW account instead.
const register = async (req, res) => {
  const t = req.firebase;
  const existing = await findCustomer(t.uid);
  if (existing) {
    if (existing.doc.isActive === false) return res.status(403).json({ message: "This account has been disabled. Contact support." });
    return signedIn(res, 200, existing.Model, existing.doc, false);
  }
  const name = registerSchema.parse(req.body ?? {}).name || str(t.name, 80);
  // Firebase only puts phone_number in a token after verifying the number by SMS.
  const phone = typeof t.phone_number === "string" ? cleanPhone(t.phone_number) : "";
  const email = typeof t.email === "string" && t.email.length <= 254 ? t.email.trim().toLowerCase() : "";

  if (isValidPhone(phone)) {
    const account = await User.findOne({ phone }).lean();
    if (account) {
      if (account.firebaseUid && account.firebaseUid !== t.uid)
        return res.status(409).json({ message: "This account is already linked to another sign-in." });
      if (account.isActive === false) return res.status(403).json({ message: "This account has been disabled. Contact support." });
      // Only link an account that is not linked yet; a concurrent link to another uid loses.
      const linked = await User.findOneAndUpdate(
        { _id: account._id, $or: [{ firebaseUid: { $exists: false } }, { firebaseUid: null }, { firebaseUid: t.uid }] },
        { $set: { firebaseUid: t.uid } },
        { new: true },
      ).lean();
      if (!linked) return res.status(409).json({ message: "This account is already linked to another sign-in." });
      return signedIn(res, 200, User, linked, false);
    }
    const created = await User.create({
      phone, name, role: "user", isActive: true, savedProperties: [], compareProperties: [], firebaseUid: t.uid, createdAt: new Date(),
    });
    return signedIn(res, 201, User, created.toObject ? created.toObject() : created, true);
  }

  if (!email) return res.status(400).json({ message: "Sign in with a phone number or an email address." });
  if (t.email_verified !== true) return res.status(400).json({ message: "Verify your email address before continuing." });
  // Email addresses are unique per account, and an existing account is never linked by email.
  if (await SignUpUser.findOne({ email }).lean())
    return res.status(409).json({ message: "An account with this email already exists. Sign in with your phone number instead." });
  const created = await SignUpUser.create({
    fullName: name || email.split("@")[0], email, phone: "", password: "", role: "user", isActive: true,
    savedProperties: [], compareProperties: [], firebaseUid: t.uid, createdAt: new Date(),
  });
  await signedIn(res, 201, SignUpUser, created.toObject ? created.toObject() : created, true);
};

// ----- Activity -----------------------------------------------------------------------------
const getMyActivity = async (req, res) => {
  const { doc } = req.customer;
  const page = intIn(req.query.heartPage, 1, 1, 100000);
  const limit = intIn(req.query.heartLimit, 20, 1, 50);
  const heartedIds = (doc.savedProperties || []).map(String);
  const newestFirst = [...heartedIds].reverse();
  const [heartProperties, compareProperties] = await Promise.all([
    cardsFor(newestFirst.slice((page - 1) * limit, page * limit)),
    cardsFor((doc.compareProperties || []).map(String)),
  ]);
  res.json({
    success: true,
    heartedIds,
    heartProperties,
    heartPagination: { page, limit, total: heartedIds.length, hasMore: page * limit < heartedIds.length },
    compareProperties,
  });
};

// Full replace: the list becomes the first 4 syntactically valid ids sent; others are dropped.
const putCompare = async (req, res) => {
  const parsed = compareSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: "propertyIds must be an array" });
  const ids = parsed.data.propertyIds;
  const kept = [...new Set(ids.filter((id) => typeof id === "string").map((id) => id.trim()).filter(isPropertyId))].slice(0, MAX_COMPARE);
  const { Model, doc } = req.customer;
  await Model.updateOne({ _id: doc._id }, { $set: { compareProperties: kept } });
  res.json({ success: true, compareProperties: await cardsFor(kept) });
};

const toggleHeart = async (req, res) => {
  const id = req.params.propertyId;
  if (!isPropertyId(id)) return res.status(400).json({ message: "Invalid property ID" });
  const property = await Property.findOne({ $and: [PUBLIC, { _id: propertyIdMatch(id) }] }).lean();
  if (!property) return res.status(404).json({ message: "Property not found" });
  const { Model } = req.customer;
  const doc = await Model.findById(req.customer.doc._id).lean();
  if (!doc) return res.status(404).json({ message: "Customer not found" });
  const saved = doc.savedProperties || [];
  const isHearted = !saved.some((x) => String(x) === String(property._id));
  if (isHearted && saved.length >= MAX_HEARTS) return res.status(400).json({ message: `You can only save up to ${MAX_HEARTS} properties.` });
  const result = await Model.updateOne(
    { _id: doc._id },
    isHearted ? { $addToSet: { savedProperties: property._id } } : { $pull: { savedProperties: property._id } },
  );
  if (!result.matchedCount) return res.status(404).json({ message: "Customer not found" });
  const after = await Model.findById(doc._id).lean();
  res.json({ success: true, isHearted, heartedIds: (after?.savedProperties || []).map(String) });
};

module.exports = { register, getMyActivity, putCompare, toggleHeart };
