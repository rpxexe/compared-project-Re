const { Property } = require("../models");
const { bad } = require("../utils/errors");
const { withFilterFields } = require("../utils/filterFields");
const { listingFields } = require("../utils/ownListing");
const { getSettings } = require("../utils/crmSettings");
const { notify } = require("../utils/notify");
const { activeStaffIds } = require("../utils/accounts");

// Tells staff a listing is waiting for review.
async function notifyPending(id, title) {
  await notify(await activeStaffIds(), {
    type: "approval",
    title: "Listing waiting for approval",
    message: title,
    data: { propertyId: String(id) },
  });
}

const postProperty = async (req, res) => {
  const { d, opt, errors } = req.postPropertyParsed || {};
  if (Object.keys(errors).length)
    throw bad("Please fix the highlighted fields", { errors });

  const staff = ["admin", "superadmin"].includes(req.user.role);
  const approvalStatus = staff || (await getSettings()).autoApprovePosts ? "approved" : "pending";
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
  if (approvalStatus === "pending") await notifyPending(created._id, d.title);
  res.status(201).json({
    property: { id: String(created._id), title: d.title, approvalStatus },
    message:
      approvalStatus === "approved"
        ? "Your property is live."
        : "Submitted for review. It will appear once approved.",
  });
};

exports.postProperty = postProperty;
exports.notifyPending = notifyPending;
