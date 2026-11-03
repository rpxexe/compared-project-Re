const { Property, Lead, Enquiry, PropertyView, PropertyRating, User, SignUpUser } = require("../models");
const { AppError, bad } = require("../utils/errors");
const { str, paging, requirePropertyId, propertyIdMatch, requireObjectId } = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { buildPropertyFilter, buildSort } = require("../utils/propertyQuery");
const { withFilterFields } = require("../utils/filterFields");
const { editableFromDoc, listingFields } = require("../utils/ownListing");
const { removeListing } = require("../utils/listingCleanup");
const { findAccount, namesById } = require("../utils/accounts");
const { countBy } = require("../utils/countBy");
const { audit, diff } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { publicRating } = require("../utils/rating");
const { listLeads } = require("./crm-leads-controller");
const { z, validate, text } = require("../utils/zod");

const isSuper = (req) => req.user.role === "superadmin";
const APPROVAL = ["approved", "rejected", "pending"];
// Fields of an app-posted listing that staff can edit (everything the post form sends).
const CONTENT_KEYS = Object.keys(editableFromDoc({}));

// Moderation fields; listing content in the same body is validated by the post-property schema.
const moderationSchema = z.looseObject({
  approvalStatus: z.enum(APPROVAL, { error: "approvalStatus must be approved, rejected or pending" }).optional(),
  rejectionReason: text(300).optional(),
  featured: z.boolean({ error: "featured must be true or false" }).optional(),
}).refine((b) => b.approvalStatus !== "rejected" || !!b.rejectionReason,
  { error: "Give a rejectionReason when rejecting a listing", path: ["rejectionReason"] });

const createSchema = z.looseObject({
  ownerUserId: z.preprocess((v) => (v ? str(v, 30) : undefined), z.string().optional()),
  featured: z.boolean({ error: "featured must be true or false" }).optional(),
});

// Staff view of listings: normalised card plus moderation fields and lead counts.
async function propertyItems(docs) {
  const ids = docs.map((d) => d._id);
  const [leads, views, enquiries, names] = await Promise.all([
    countBy(Lead, "property", ids),
    countBy(PropertyView, "property", ids),
    countBy(Enquiry, "property", ids),
    namesById(docs.flatMap((d) => [d.ownerUserId, d.reviewedBy])),
  ]);
  return docs.map((d) => ({
    ...normalizeProperty(d),
    rejectionReason: d.rejectionReason || "",
    ownerUserId: d.ownerUserId ? String(d.ownerUserId) : "",
    ownerName: d.ownerUserId ? names.get(String(d.ownerUserId)) || "" : "",
    contactPhone: d.contactPhone || "",
    reviewedBy: d.reviewedBy ? { id: String(d.reviewedBy), name: names.get(String(d.reviewedBy)) || "" } : null,
    reviewedAt: d.reviewedAt || null,
    leadCount: leads.get(String(d._id)) || 0,
    viewCount: views.get(String(d._id)) || 0,
    enquiryCount: enquiries.get(String(d._id)) || 0,
  }));
}

async function listProperties(req, res, forced = {}) {
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const q = { ...req.query, ...forced };
  const base = buildPropertyFilter(q, { includeHidden: true });
  const extra = [];
  const owner = str(q.ownerUserId, 30);
  if (owner) extra.push({ ownerUserId: requireObjectId(owner, "ownerUserId") });
  const filter = extra.length ? { $and: [base, ...extra] } : base;
  const [docs, total] = await Promise.all([
    Property.find(filter).sort(buildSort(q.sort)).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  res.json({ items: await propertyItems(docs), total, page, limit });
}

async function findListing(id) {
  const doc = await Property.findOne({ _id: propertyIdMatch(requirePropertyId(id)) }).lean();
  if (!doc) throw new AppError(404, "Property not found");
  return doc;
}

const getProperties = (req, res) => listProperties(req, res);

const getProperty = async (req, res) => {
  const doc = await findListing(req.params.id);
  const [[item], owner, rating, views, uniqueViewers, enquiries, leads, saves] = await Promise.all([
    propertyItems([doc]),
    doc.ownerUserId ? findAccount(doc.ownerUserId) : null,
    PropertyRating.findOne({ property: doc._id }).lean(),
    PropertyView.find({ property: doc._id }).select("views").lean(),
    PropertyView.countDocuments({ property: doc._id }),
    Enquiry.countDocuments({ property: doc._id }),
    Lead.countDocuments({ property: doc._id }),
    Promise.all([User, SignUpUser].filter(Boolean).map((M) => M.countDocuments({ savedProperties: doc._id }))),
  ]);
  res.json({
    property: item,
    owner: owner
      ? { id: String(owner.doc._id), name: owner.doc.name || owner.doc.fullName || "", phone: owner.doc.phone || "", role: owner.doc.role || "user" }
      : null,
    rating: publicRating(rating),
    counts: {
      views: views.reduce((n, v) => n + (v.views || 0), 0),
      uniqueViewers,
      enquiries,
      leads,
      saves: saves.reduce((a, b) => a + b, 0),
    },
    editable: doc.dataSource === "manual",
  });
};

// Validates post-form input with the same rules as POST /post-property.
function parseListing(input) {
  const { parse } = require("../routes/postProperty");
  const { d, opt, errors } = parse(input);
  if (Object.keys(errors).length) throw bad("Please fix the highlighted fields", { errors });
  return {
    ...listingFields(d, opt),
    city: d.city,
    locality: d.locality,
    propertyType: d.propertyType,
    ...(d.bhk ? { bhk: d.bhk } : {}),
  };
}

const createProperty = async (req, res) => {
  const b = validate(createSchema, req.body);
  let owner = null;
  if (b.ownerUserId) {
    owner = await findAccount(b.ownerUserId);
    if (!owner) throw bad("Owner not found", { errors: { ownerUserId: "No user with this id" } });
  }
  const fields = parseListing(b);
  const now = new Date();
  const doc = {
    ...fields,
    contactPhone: fields.contactPhone || owner?.doc.phone || req.user.phone,
    dataSource: "manual",
    approvalStatus: "approved",
    reviewedBy: req.user.id,
    reviewedAt: now,
    ownerUserId: owner ? String(owner.doc._id) : req.user.id,
    ownerRole: owner ? owner.doc.role || "user" : req.user.role,
    ...(typeof b.featured === "boolean" ? { featured: b.featured } : {}),
    createdAt: now,
  };
  const created = await Property.create(withFilterFields(doc));
  const plain = created.toObject ? created.toObject() : created;
  await audit(req, "create", "property", plain._id, { title: [null, fields.title], ownerUserId: [null, doc.ownerUserId] });
  res.status(201).json({ property: (await propertyItems([plain]))[0] });
};

// Moderation and (for app-posted listings) content edits. Shared by PATCH and bulk actions.
async function applyUpdate(req, doc, raw) {
  const b = validate(moderationSchema, raw);
  const set = {};
  const unset = {};
  if (b.approvalStatus !== undefined) {
    set.approvalStatus = b.approvalStatus;
    set.reviewedBy = req.user.id;
    set.reviewedAt = new Date();
    if (b.approvalStatus === "approved") unset.rejectionReason = "";
  }
  if (b.rejectionReason !== undefined && set.approvalStatus !== "approved") set.rejectionReason = b.rejectionReason;
  if (b.featured !== undefined) set.featured = b.featured;
  const content = CONTENT_KEYS.filter((k) => b[k] !== undefined);
  if (content.length) {
    if (doc.dataSource !== "manual") throw new AppError(403, "Imported properties can only be moderated, not edited");
    const merged = { ...editableFromDoc(doc), ...Object.fromEntries(content.map((k) => [k, b[k]])) };
    Object.assign(set, parseListing(merged), { updatedAt: new Date() });
  }
  if (!Object.keys(set).length && !Object.keys(unset).length) throw bad("Nothing to update");
  if (content.length) set.filterFields = withFilterFields({ ...doc, ...set }).filterFields;

  await Property.updateOne({ _id: doc._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  const after = { ...doc, ...set };
  Object.keys(unset).forEach((k) => delete after[k]);

  const changes = diff(doc, { ...set, ...(unset.rejectionReason !== undefined && doc.rejectionReason ? { rejectionReason: "" } : {}) });
  ["reviewedBy", "reviewedAt", "updatedAt", "filterFields"].forEach((k) => delete changes[k]);
  if (Object.keys(changes).length) await audit(req, "update", "property", doc._id, changes);

  const reviewed = set.approvalStatus && set.approvalStatus !== doc.approvalStatus && set.approvalStatus !== "pending";
  if (reviewed && doc.ownerUserId && String(doc.ownerUserId) !== req.user.id) {
    const title = normalizeProperty(after).title;
    await notify(String(doc.ownerUserId), set.approvalStatus === "approved"
      ? { type: "property", title: "Your listing is live", message: title, data: { propertyId: String(doc._id) } }
      : { type: "property", title: "Your listing was not approved", message: `${title}: ${set.rejectionReason || doc.rejectionReason || ""}`, data: { propertyId: String(doc._id) } });
  }
  return after;
}

const updateProperty = async (req, res) => {
  const doc = await findListing(req.params.id);
  const after = await applyUpdate(req, doc, req.body || {});
  res.json({ property: (await propertyItems([after]))[0] });
};

async function deleteListing(req, doc) {
  if (doc.dataSource !== "manual") throw new AppError(403, "Imported properties cannot be deleted");
  await removeListing(doc);
  await audit(req, "delete", "property", doc._id, { title: [normalizeProperty(doc).title, null] });
}

// Only app-posted listings can be deleted; imported source data is protected.
const deleteProperty = async (req, res) => {
  await deleteListing(req, await findListing(req.params.id));
  res.json({ deleted: true });
};

const BULK = {
  approve: { approvalStatus: "approved" },
  reject: { approvalStatus: "rejected" },
  feature: { featured: true },
  unfeature: { featured: false },
};

const IDS_ERROR = "ids must be a list of 1 to 100 property ids";
const BULK_ACTIONS = [...Object.keys(BULK), "delete"];
const bulkSchema = z.object({
  ids: z.array(z.any(), { error: IDS_ERROR }).min(1, { error: IDS_ERROR }).max(100, { error: IDS_ERROR }),
  action: z.enum(BULK_ACTIONS, { error: `action must be one of: ${BULK_ACTIONS.join(", ")}` }),
  rejectionReason: text(300).optional(),
}).refine((b) => b.action !== "reject" || !!b.rejectionReason,
  { error: "Give a rejectionReason when rejecting listings", path: ["rejectionReason"] });

const bulkProperties = async (req, res) => {
  const { ids, action, rejectionReason } = validate(bulkSchema, req.body);
  if (action === "delete" && !isSuper(req)) throw new AppError(403, "Only a super admin can delete listings");
  let updated = 0;
  const failed = [];
  for (const id of [...new Set(ids.map(String))]) {
    try {
      const doc = await findListing(id);
      if (action === "delete") await deleteListing(req, doc);
      else await applyUpdate(req, doc, { ...BULK[action], ...(action === "reject" ? { rejectionReason } : {}) });
      updated += 1;
    } catch (e) {
      failed.push({ id, message: e.status && e.status < 500 ? e.message : "Something went wrong" });
    }
  }
  res.json({ updated, failed });
};

const getPropertyLeads = async (req, res) => {
  const doc = await findListing(req.params.id);
  await listLeads(req, res, { propertyId: String(doc._id) });
};

module.exports = {
  listProperties, propertyItems,
  getProperties, getProperty, createProperty, updateProperty, deleteProperty, bulkProperties, getPropertyLeads,
};
