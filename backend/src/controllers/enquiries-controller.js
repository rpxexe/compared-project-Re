const mongoose = require("mongoose");
const { Property, Enquiry, User } = require("../models");
const { propertyIdMatch, requirePropertyId, str } = require("../utils/validate");
const { AppError } = require("../utils/errors");
const { normalizeProperty } = require("../utils/property");

const postEnquiry = async (req, res) => {
  const propertyId = requirePropertyId(str(req.body?.propertyId, 40));
  const message = str(req.body?.message, 1000);
  const property = await Property.findOne({ _id: propertyIdMatch(propertyId) }).lean();
  if (!property || ["pending", "rejected"].includes(property.approvalStatus))
    throw new AppError(404, "Property not found");
  const user = await User.findById(req.user.id).lean();
  const name = str(req.body?.name, 80) || user?.name || "";
  const enquiry = await Enquiry.create({
    user: new mongoose.Types.ObjectId(req.user.id),
    phone: req.user.phone,
    name,
    property: property._id,
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
