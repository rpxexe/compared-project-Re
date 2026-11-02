const express = require("express");
const { User, SignUpUser, Property, Enquiry, PropertyView } = require("../models");
const { PUBLIC } = require("../utils/propertyQuery");
const { AppError, bad } = require("../utils/errors");
const { str } = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { publicUser } = require("../utils/user");
const env = require("../config/env");
const { requirePropertyId, propertyIdMatch } = require("../utils/validate");
const { withFilterFields } = require("../utils/filterFields");
const { LOCKED, editableFromDoc, lockedChanges, isOwnManual } = require("../utils/ownListing");

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
// The edited listing goes back for review unless the poster is staff (or auto-approve is on).
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
  const { d, opt, errors } = parse({ ...editableFromDoc(doc), ...patch, ...Object.fromEntries(LOCKED.map((k) => [k, editableFromDoc(doc)[k]])) });
  if (Object.keys(errors).length) throw bad("Please fix the highlighted fields", { errors });

  const staff = ["admin", "superadmin"].includes(req.user.role);
  const approvalStatus = staff || env.autoApprovePosts ? "approved" : "pending";
  const { images, parking, ...rest } = opt;
  const set = {
    title: d.title,
    price: d.price,
    area: { value: d.area, unit: "sq.ft" },
    description: d.description,
    ...rest,
    ...(parking ? { parkings: parking } : {}),
    ...(images?.length ? { coverImage: images[0], galleryImages: images } : {}),
    approvalStatus,
    updatedAt: new Date(),
  };
  const { filterFields } = withFilterFields({ ...doc, ...set });
  await Property.updateOne({ _id: doc._id }, { $set: { ...set, filterFields }, $unset: { rejectionReason: "" } });
  res.json({
    property: { id: String(doc._id), title: d.title, approvalStatus },
    message: approvalStatus === "approved" ? "Changes saved." : "Changes saved. Your listing will be live again once reviewed.",
  });
};

// DELETE /users/me/properties/:id
const deleteOwnProperty = async (req, res) => {
  const doc = await findOwnListing(req);
  await Property.deleteOne({ _id: doc._id });
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

const updateUser = async (req, res) => {
  const body = req.body || {};
  const set = {};
  if (body.name !== undefined) set.name = str(body.name, 80);
  if (body.city !== undefined) set.city = str(body.city, 80);
  if (body.purpose !== undefined) {
    const purpose = str(body.purpose, 20).toLowerCase();
    if (!User.PURPOSES.includes(purpose))
      throw bad(`Purpose must be one of: ${User.PURPOSES.join(", ")}`);
    set.purpose = purpose;
    // Choosing "broker" unlocks the broker role, but never downgrades or escalates staff roles.
    if (purpose === "broker" && req.user.role === "user") set.role = "broker";
  }
  if (!Object.keys(set).length) throw bad("Nothing to update");
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
