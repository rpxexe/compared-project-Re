const { Property } = require("../models");
const { bad } = require("../utils/errors");
const { withFilterFields } = require("../utils/filterFields");
const { listingFields } = require("../utils/ownListing");
const postProperty = async (req, res) => {
  const { d, opt, errors } = req.postPropertyParsed || {};
  if (Object.keys(errors).length)
    throw bad("Please fix the highlighted fields", { errors });

  // There is no review step: posted listings go live straight away.
  const approvalStatus = "approved";
  const doc = {
    ...listingFields(d, opt),
    city: d.city,
    locality: d.locality,
    propertyType: d.propertyType,
    ...(d.bhk ? { bhk: d.bhk } : {}),
    contactPhone: opt.contactPhone || req.user.phone,
    dataSource: "manual",
    approvalStatus,
    ownerUserId: req.user.id,
    ownerRole: req.user.role,
    createdAt: new Date(),
  };
  const created = await Property.create(withFilterFields(doc));
  res.status(201).json({
    property: { id: String(created._id), title: d.title, approvalStatus },
    message: "Your property is live.",
  });
};

exports.postProperty = postProperty;
