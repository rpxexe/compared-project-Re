const express = require("express");
const { User, SignUpUser, Property, Enquiry } = require("../models");
const { AppError, bad } = require("../utils/errors");
const { str } = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { publicUser } = require("../utils/user");

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

exports.getUser = getUser;
exports.updateUser = updateUser;
exports.getUserProperties = getUserProperties;
exports.getUserEnquiries = getUserEnquiries;
