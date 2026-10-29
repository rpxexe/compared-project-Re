const mongoose = require("mongoose");
const { Property, Enquiry, User } = require("../models");
const { requireObjectId, str } = require("../utils/validate");
const { AppError } = require("../utils/errors");
const { normalizeProperty } = require("../utils/property");

const postEnquiry = async (req, res) => {
  requireObjectId(str(req.body?.propertyId, 30), "property id");
  const message = str(req.body?.message, 1000);
  const property = await Property.findById(req.body.propertyId).lean();
  if (!property || ["pending", "rejected"].includes(property.approvalStatus))
    throw new AppError(404, "Property not found");
  const user = await User.findById(req.user.id).lean();
  const name = str(req.body?.name, 80) || user?.name || "";
  const enquiry = await Enquiry.create({
    user: new mongoose.Types.ObjectId(req.user.id),
    phone: req.user.phone,
    name,
    property: new mongoose.Types.ObjectId(req.body.propertyId),
    propertyTitle: normalizeProperty(property).title,
    message,
    source: "mobile-app",
  });
  res.status(201).json({
    enquiry: { id: String(enquiry._id), status: "new" },
    message: "Enquiry sent. We will get back to you shortly.",
  });
};

exports.postEnquiry = postEnquiry;
