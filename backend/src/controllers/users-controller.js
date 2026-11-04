const express = require("express");
const { User, SignUpUser, Property, Enquiry, PropertyView } = require("../models");
const { PUBLIC } = require("../utils/propertyQuery");
const { AppError, bad } = require("../utils/errors");
const { str } = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { publicUser } = require("../utils/user");
const { requirePropertyId, propertyIdMatch } = require("../utils/validate");
const { withFilterFields } = require("../utils/filterFields");
const { LOCKED, editableFromDoc, lockedChanges, isOwnManual, listingFields } = require("../utils/ownListing");
const { removeListing } = require("../utils/listingCleanup");
const { z, validate, text, oneOf } = require("../utils/zod");

// One of the signed-in user's own app-posted listings, or 404 (also for someone else's).
async function findOwnListing(req) {
  requirePropertyId(req.params.id);
  const doc = await Property.findOne({ _id: propertyIdMatch(req.params.id) }).lean();
  if (!isOwnManual(doc, req.user.id)) throw new AppError(404, "Property not found");
  return doc;
}

// GET /users/me/properties/:id – raw values for the edit form, plus which fields are locked.
const getOwnProperty = async (req, res) => {
  const doc = await findOwnListing(req);
  res.json({
    property: {
      id: String(doc._id),
      ...editableFromDoc(doc),
      approvalStatus: doc.approvalStatus || "",
      rejectionReason: doc.rejectionReason || "",
    },
    locked: LOCKED,
  });
};

// PATCH /users/me/properties/:id – edit everything except location, BHK, type and category.
// Edits go live straight away, like new listings.
const updateOwnProperty = async (req, res) => {
  const doc = await findOwnListing(req);
  const patch = req.body && typeof req.body === "object" ? req.body : {};
  const changedLocked = lockedChanges(doc, patch);
  if (changedLocked.length)
    throw bad("Location, BHK and property type can't be changed after posting", {
      errors: Object.fromEntries(changedLocked.map((k) => [k, "This can't be changed"])),
    });

  // Same validation as posting, run on the stored listing with the edits applied.
  const { parse } = require("../routes/postProperty");
  const { d, opt, errors } = parse({ ...editableFromDoc(doc), ...patch, ...Object.fromEntries(LOCKED.map((k) => [k, editableFromDoc(doc)[k]])) }, req.user);
  if (Object.keys(errors).length) throw bad("Please fix the highlighted fields", { errors });

  const approvalStatus = "approved";
  const set = { ...listingFields(d, opt), approvalStatus, updatedAt: new Date() };
  const { filterFields } = withFilterFields({ ...doc, ...set });
  await Property.updateOne({ _id: doc._id }, { $set: { ...set, filterFields }, $unset: { rejectionReason: "" } });
  res.json({
    property: { id: String(doc._id), title: d.title, approvalStatus },
    message: "Changes saved.",
  });
};

// DELETE /users/me/properties/:id
const deleteOwnProperty = async (req, res) => {
  const doc = await findOwnListing(req);
  await removeListing(doc);
  res.json({ deleted: true });
};

const getUser = async (req, res) => {
  let user = await User.findById(req.user.id).lean();
  if (!user && SignUpUser) {
    user = await SignUpUser.findById(req.user.id).lean();
  }
  if (!user) throw new AppError(404, "User not found");
  res.json({
    user: publicUser(user),
    savedIds: (user.savedProperties || []).map(String),
    createdAt: user.createdAt,
  });
};

// Only these fields can be changed by the user; anything else (role, phone...) is dropped.
const profileSchema = () => z.object({
  name: text(80).optional(),
  city: text(80).optional(),
  purpose: z.preprocess((v) => (v === undefined ? undefined : str(v, 20).toLowerCase()),
    oneOf(User.PURPOSES, "Purpose").optional()),
});

const updateUser = async (req, res) => {
  const set = Object.fromEntries(Object.entries(validate(profileSchema(), req.body)).filter(([, v]) => v !== undefined));
  if (!Object.keys(set).length) throw bad("Nothing to update");
  // Choosing "broker" unlocks the broker role, but never downgrades or escalates staff roles.
  if (set.purpose === "broker" && req.user.role === "user") set.role = "broker";
  let user = await User.findOneAndUpdate(
    { _id: req.user.id },
    { $set: set },
    { new: true },
  ).lean();
  if (!user && SignUpUser) {
    user = await SignUpUser.findOneAndUpdate(
      { _id: req.user.id },
      { $set: set },
      { new: true },
    ).lean();
  }
  if (!user) throw new AppError(404, "User not found");
  res.json({ user: publicUser(user) });
};

const getUserProperties = async (req, res) => {
  const docs = await Property.find({ ownerUserId: req.user.id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();
  res.json({
    items: docs.map((d) => ({
      ...normalizeProperty(d),
      rejectionReason: d.rejectionReason || "",
    })),
  });
};

const getUserEnquiries = async (req, res) => {
  const items = await Enquiry.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    items: items.map((e) => ({
      id: String(e._id),
      property: String(e.property),
      propertyTitle: e.propertyTitle,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
    })),
  });
};

// The signed-in user's viewed listings (stored by POST /properties/:id/view), newest first.
const getUserViews = async (req, res) => {
  const rows = await PropertyView.find({ user: req.user.id, hiddenByUser: { $ne: true } })
    .sort({ lastViewedAt: -1, _id: -1 })
    .limit(50)
    .lean();
  const docs = rows.length
    ? await Property.find({ $and: [PUBLIC, { _id: { $in: rows.map((r) => r.property) } }] }).lean()
    : [];
  // Required lazily: properties-controller is the heavier module and owns the rating lookup.
  const { withRatings } = require("./properties-controller");
  const byId = new Map((await withRatings(docs)).map((p) => [p.id, p]));
  const items = rows
    .map((r) => byId.get(String(r.property)) && { ...byId.get(String(r.property)), viewedAt: r.lastViewedAt, views: r.views })
    .filter(Boolean);
  res.json({ items, total: items.length });
};

const clearUserViews = async (req, res) => {
  await PropertyView.updateMany({ user: req.user.id }, { $set: { hiddenByUser: true } });
  res.status(204).end();
};

exports.getUser = getUser;
exports.updateUser = updateUser;
exports.getUserProperties = getUserProperties;
exports.getUserEnquiries = getUserEnquiries;
exports.getUserViews = getUserViews;
exports.getOwnProperty = getOwnProperty;
exports.updateOwnProperty = updateOwnProperty;
exports.deleteOwnProperty = deleteOwnProperty;
exports.clearUserViews = clearUserViews;
