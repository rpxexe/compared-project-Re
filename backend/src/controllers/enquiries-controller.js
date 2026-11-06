const mongoose = require("mongoose");
const { Property, Enquiry } = require("../models");
const { propertyIdMatch, str } = require("../utils/validate");
const { AppError } = require("../utils/errors");
const { normalizeProperty } = require("../utils/property");
const { isPublic } = require("../utils/propertyQuery");
const { z, validate, text, propertyId: propertyIdField } = require("../utils/zod");

const enquirySchema = z.object({
  propertyId: z.preprocess((v) => str(v, 40), propertyIdField()),
  message: text(1000).optional(),
  name: text(80).optional(),
});

const postEnquiry = async (req, res) => {
  const body = validate(enquirySchema, req.body);
  const { propertyId } = body;
  const message = body.message || "";
  const property = await Property.findOne({ _id: propertyIdMatch(propertyId) }).lean();
  // Same visibility as the listing itself: hidden listings take no enquiries.
  if (!isPublic(property)) throw new AppError(404, "Property not found");
  const name = body.name || req.user.name || "";
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
