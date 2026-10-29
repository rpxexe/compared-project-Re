const env = require("../config/env");
const { Property } = require("../models");
const { bad } = require("../utils/errors");

const postProperty = async (req, res) => {
  const { d, opt, errors } = req.postPropertyParsed || {};
  if (Object.keys(errors).length)
    throw bad("Please fix the highlighted fields", { errors });

  const staff = ["admin", "superadmin"].includes(req.user.role);
  const approvalStatus = staff || env.autoApprovePosts ? "approved" : "pending";
  const { images, parking, ...rest } = opt;
  const doc = {
    title: d.title,
    city: d.city,
    locality: d.locality,
    propertyType: d.propertyType,
    ...(d.bhk ? { bhk: d.bhk } : {}),
    price: d.price,
    area: { value: d.area, unit: "sq.ft" },
    description: d.description,
    ...rest,
    ...(parking ? { parkings: parking } : {}),
    ...(images?.length ? { coverImage: images[0], galleryImages: images } : {}),
    contactPhone: opt.contactPhone || req.user.phone,
    dataSource: "manual",
    approvalStatus,
    ownerUserId: req.user.id,
    ownerRole: req.user.role,
    createdAt: new Date(),
  };
  const created = await Property.create(doc);
  res.status(201).json({
    property: { id: String(created._id), title: d.title, approvalStatus },
    message:
      approvalStatus === "approved"
        ? "Your property is live."
        : "Submitted for review. It will appear once approved.",
  });
};

exports.postProperty = postProperty;
//module.exports.parse = parse;
