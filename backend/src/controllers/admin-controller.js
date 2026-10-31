const { User, Property, Enquiry, Review } = require("../models");
const { AppError, bad } = require("../utils/errors");
const {
  requireObjectId,
  requirePropertyId,
  propertyIdMatch,
  paging,
  str,
  escapeRegex,
} = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { buildPropertyFilter } = require("../utils/propertyQuery");
const { publicUser } = require("../utils/user");
const { recompute } = require("./properties-controller");

const getStats = async (req, res) => {
  const [users, properties, manual, pending, enquiries, newEnquiries, reviews] =
    await Promise.all([
      User.countDocuments({}),
      Property.countDocuments({}),
      Property.countDocuments({ dataSource: "manual" }),
      Property.countDocuments({ approvalStatus: "pending" }),
      Enquiry.countDocuments({}),
      Enquiry.countDocuments({ status: "new" }),
      Review.countDocuments({}),
    ]);
  res.json({
    users,
    properties,
    manualProperties: manual,
    pendingApprovals: pending,
    enquiries,
    newEnquiries,
    reviews,
  });
};

const getUsers = async (req, res) => {
  const { page, limit, skip } = paging(req.query, {
    defLimit: 20,
    maxLimit: 50,
  });
  const and = [];
  const search = str(req.query.search, 40);
  if (search)
    and.push({
      $or: [
        { phone: new RegExp(escapeRegex(search)) },
        { name: new RegExp(escapeRegex(search), "i") },
      ],
    });
  const role = str(req.query.role, 12);
  if (User.ROLES.includes(role)) and.push({ role });
  const filter = and.length ? { $and: and } : {};
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    items: items.map((u) => ({
      ...publicUser(u),
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
    })),
    total,
    page,
  });
};

const updateUser = async (req, res) => {
  requireObjectId(req.params.id, "user id");
  const set = {};
  if (req.body?.role !== undefined) {
    if (!User.ROLES.includes(req.body.role))
      throw bad(`Role must be one of: ${User.ROLES.join(", ")}`);
    set.role = req.body.role;
  }
  if (typeof req.body?.isActive === "boolean") set.isActive = req.body.isActive;
  if (!Object.keys(set).length) throw bad("Nothing to update");
  if (req.params.id === req.user.id)
    throw new AppError(400, "You cannot change your own role or status");
  const user = await User.findOneAndUpdate(
    { _id: req.params.id },
    { $set: set },
    { new: true },
  ).lean();
  if (!user) throw new AppError(404, "User not found");
  res.json({
    user: { ...publicUser(user), isActive: user.isActive !== false },
  });
};

const getProperties = async (req, res) => {
  const { page, limit, skip } = paging(req.query, {
    defLimit: 20,
    maxLimit: 50,
  });
  const filter = buildPropertyFilter(req.query, { includeHidden: true });
  const [docs, total] = await Promise.all([
    Property.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Property.countDocuments(filter),
  ]);
  res.json({
    items: docs.map((d) => ({
      ...normalizeProperty(d),
      rejectionReason: d.rejectionReason || "",
      ownerUserId: d.ownerUserId ? String(d.ownerUserId) : "",
      contactPhone: d.contactPhone || "",
    })),
    total,
    page,
  });
};

const updateProperty = async (req, res) => {
  requirePropertyId(req.params.id);
  const set = {};
  const b = req.body || {};
  if (b.approvalStatus !== undefined) {
    if (!["approved", "rejected", "pending"].includes(b.approvalStatus))
      throw bad("approvalStatus must be approved, rejected or pending");
    set.approvalStatus = b.approvalStatus;
    set.reviewedBy = req.user.id;
    set.reviewedAt = new Date();
  }
  if (b.rejectionReason !== undefined)
    set.rejectionReason = str(b.rejectionReason, 300);
  if (typeof b.featured === "boolean") set.featured = b.featured;
  if (!Object.keys(set).length) throw bad("Nothing to update");
  const doc = await Property.findOneAndUpdate(
    { _id: propertyIdMatch(req.params.id) },
    { $set: set },
    { new: true },
  ).lean();
  if (!doc) throw new AppError(404, "Property not found");
  res.json({ property: normalizeProperty(doc) });
};

// Only submissions created through the app can be deleted; imported source data is protected.
const deleteProperty = async (req, res) => {
  requirePropertyId(req.params.id);
  const doc = await Property.findOne({ _id: propertyIdMatch(req.params.id) }).lean();
  if (!doc) throw new AppError(404, "Property not found");
  if (doc.dataSource !== "manual")
    throw new AppError(
      403,
      "Imported properties cannot be deleted from the app",
    );
  await Property.deleteOne({ _id: doc._id });
  res.json({ deleted: true });
};

const getEnquiries = async (req, res) => {
  const { page, limit, skip } = paging(req.query, {
    defLimit: 20,
    maxLimit: 50,
  });
  const status = str(req.query.status, 12);
  const filter = ["new", "contacted", "closed"].includes(status)
    ? { status }
    : {};
  const [items, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Enquiry.countDocuments(filter),
  ]);
  res.json({
    items: items.map((e) => ({
      id: String(e._id),
      phone: e.phone,
      name: e.name,
      property: String(e.property),
      propertyTitle: e.propertyTitle,
      message: e.message,
      source: e.source,
      status: e.status,
      createdAt: e.createdAt,
    })),
    total,
    page,
  });
};

const updateEnquiry = async (req, res) => {
  requireObjectId(req.params.id, "enquiry id");
  if (!["new", "contacted", "closed"].includes(req.body?.status))
    throw bad("status must be new, contacted or closed");
  const e = await Enquiry.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { status: req.body.status } },
    { new: true },
  ).lean();
  if (!e) throw new AppError(404, "Enquiry not found");
  res.json({ enquiry: { id: String(e._id), status: e.status } });
};

const deleteReview = async (req, res) => {
  requireObjectId(req.params.id, "review id");
  const r = await Review.findById(req.params.id).lean();
  if (!r) throw new AppError(404, "Review not found");
  await Review.deleteOne({ _id: req.params.id });
  await recompute(r.property);
  res.json({ deleted: true });
};

exports.getStats = getStats;
exports.getUsers = getUsers;
exports.updateUser = updateUser;
exports.getProperties = getProperties;
exports.updateProperty = updateProperty;
exports.deleteProperty = deleteProperty;
exports.getEnquiries = getEnquiries;
exports.updateEnquiry = updateEnquiry;
exports.deleteReview = deleteReview;
