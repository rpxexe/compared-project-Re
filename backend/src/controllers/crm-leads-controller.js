const mongoose = require("mongoose");
const { Lead, LeadActivity, Enquiry, PropertyView, Property, Review } = require("../models");
const { AppError, bad } = require("../utils/errors");
const {
  str, escapeRegex, paging, requireObjectId, propertyIdMatch,
  requirePropertyId,
} = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const { findAccount, findAccountByPhone, findActiveStaff, accountView, namesById } = require("../utils/accounts");
const { getSettings } = require("../utils/crmSettings");
const { audit, diff } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { istDayStart, istDayEnd, optDate, DAY_MS } = require("../utils/dates");
const { CLOSED, OUTREACH, scoreLead, propertySnapshot, logActivity, refresh, syncEnquiries } = require("../utils/leads");
const { recompute } = require("./properties-controller");
const {
  z, validate, text, phone: phoneField, propertyId: propertyIdField, date, money, oneOf, EMAIL: EMAIL_RE,
} = require("../utils/zod");

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const isSuper = (req) => req.user.role === "superadmin";
const list = (v, allowed) => str(v, 300).split(",").map((s) => s.trim()).filter((s) => allowed.includes(s));

// ----- Serializers ------------------------------------------------------------------------
function leadView(l, names = new Map()) {
  return {
    id: String(l._id),
    status: l.status,
    priority: l.priority,
    score: l.score || 0,
    name: l.name || "",
    phone: l.phone || "",
    email: l.email || "",
    city: l.city || "",
    purpose: l.purpose || "",
    user: l.user ? String(l.user) : null,
    property: l.property != null
      ? { id: String(l.property), title: l.propertyTitle || "", location: l.propertyLocation || "", price: l.propertyPrice || "" }
      : null,
    sources: l.sources || [],
    primarySource: l.primarySource || "",
    viewCount: l.viewCount || 0,
    enquiryCount: (l.enquiryIds || []).length,
    assignedTo: l.assignedTo ? { id: String(l.assignedTo), name: names.get(String(l.assignedTo)) || "" } : null,
    assignedAt: l.assignedAt || null,
    nextFollowUpAt: l.nextFollowUpAt || null,
    lostReason: l.lostReason || "",
    budgetMin: l.budgetMin ?? null,
    budgetMax: l.budgetMax ?? null,
    tags: l.tags || [],
    lastActivityAt: l.lastActivityAt || null,
    createdAt: l.createdAt || null,
    updatedAt: l.updatedAt || null,
  };
}

async function leadViews(leads) {
  const names = await namesById(leads.map((l) => l.assignedTo));
  return leads.map((l) => leadView(l, names));
}

const activityView = (a, names = new Map()) => ({
  id: String(a._id),
  lead: String(a.lead),
  type: a.type,
  body: a.body || "",
  outcome: a.outcome || "",
  scheduledAt: a.scheduledAt || null,
  completedAt: a.completedAt || null,
  durationSeconds: a.durationSeconds ?? null,
  meta: a.meta || {},
  createdBy: a.createdBy ? { id: String(a.createdBy), name: names.get(String(a.createdBy)) || "" } : null,
  createdAt: a.createdAt || null,
});

async function activityViews(items) {
  const names = await namesById(items.map((a) => a.createdBy));
  return items.map((a) => activityView(a, names));
}

// ----- Filters ----------------------------------------------------------------------------
const SORTS = {
  "-lastActivityAt": { lastActivityAt: -1, _id: -1 },
  "-createdAt": { createdAt: -1, _id: -1 },
  nextFollowUpAt: { nextFollowUpAt: 1, _id: 1 },
  "-score": { score: -1, _id: -1 },
  "-viewCount": { viewCount: -1, _id: -1 },
};

function followUpCondition(when, now = new Date()) {
  switch (when) {
    case "overdue": return { nextFollowUpAt: { $lt: now }, status: { $nin: CLOSED } };
    case "today": return { nextFollowUpAt: { $gte: istDayStart(now), $lte: istDayEnd(now) }, status: { $nin: CLOSED } };
    case "upcoming": return { nextFollowUpAt: { $gt: now }, status: { $nin: CLOSED } };
    case "none": return { nextFollowUpAt: null };
    default: return null;
  }
}

function leadFilter(q, req) {
  const and = [];
  const search = str(q.search, 60);
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    and.push({ $or: [{ phone: re }, { name: re }, { email: re }, { propertyTitle: re }] });
  }
  const statuses = list(q.status, Lead.STATUSES);
  if (statuses.length) and.push({ status: { $in: statuses } });
  const sources = list(q.source, Lead.SOURCES);
  if (sources.length) and.push({ sources: { $in: sources } });
  const priorities = list(q.priority, Lead.PRIORITIES);
  if (priorities.length) and.push({ priority: { $in: priorities } });
  const assigned = str(q.assignedTo, 30);
  if (assigned === "me") and.push({ assignedTo: oid(req.user.id) });
  else if (assigned === "unassigned") and.push({ assignedTo: null });
  else if (assigned) and.push({ assignedTo: oid(requireObjectId(assigned, "assignedTo")) });
  const propertyId = str(q.propertyId, 40);
  if (propertyId) and.push({ property: propertyIdMatch(requirePropertyId(propertyId)) });
  const userId = str(q.userId, 30);
  if (userId) and.push({ user: oid(requireObjectId(userId, "userId")) });
  const city = str(q.city, 60);
  if (city) {
    const re = new RegExp(escapeRegex(city), "i");
    and.push({ $or: [{ city: re }, { propertyLocation: re }] });
  }
  const followUp = followUpCondition(str(q.followUp, 10));
  if (followUp) and.push(followUp);
  const dateField = str(q.dateField, 20) === "lastActivityAt" ? "lastActivityAt" : "createdAt";
  const from = optDate(q.from, "from");
  const to = optDate(q.to, "to");
  if (from || to) and.push({ [dateField]: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } });
  if (q.minScore !== undefined && q.minScore !== "") {
    const n = Number(q.minScore);
    if (!(n >= 0 && n <= 100)) throw bad("minScore must be from 0 to 100");
    and.push({ score: { $gte: n } });
  }
  return and.length ? { $and: and } : {};
}

async function listLeads(req, res, forced = {}) {
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const q = { ...req.query, ...forced };
  const filter = leadFilter(q, req);
  const sort = SORTS[str(q.sort, 20)] || SORTS["-lastActivityAt"];
  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  res.json({ items: await leadViews(items), total, page, limit });
}

async function findLead(id) {
  requireObjectId(id, "lead id");
  const lead = await Lead.findById(id).lean();
  if (!lead) throw new AppError(404, "Lead not found");
  return lead;
}

// ----- Shared write logic (single + bulk) ---------------------------------------------------
// Resolves who a lead may be assigned to. Admins may only take a lead, or release their own.
async function resolveAssignee(req, lead, value) {
  if (value === null || value === "") {
    if (!isSuper(req) && lead && String(lead.assignedTo || "") !== req.user.id)
      throw new AppError(403, "Only a super admin can unassign someone else's lead");
    return null;
  }
  const target = value === "me" ? req.user.id : str(value, 30);
  if (!isSuper(req) && target !== req.user.id)
    throw new AppError(403, "Admins can only assign leads to themselves");
  if (!(await findActiveStaff(target))) throw bad("assignedTo must be an active staff member");
  return target;
}

async function assign(req, lead, value) {
  const to = await resolveAssignee(req, lead, value);
  const from = lead.assignedTo ? String(lead.assignedTo) : null;
  if (from === to) return lead;
  const set = { assignedTo: to ? oid(to) : null, assignedAt: new Date() };
  await Lead.updateOne({ _id: lead._id }, { $set: set });
  await logActivity(lead, "assignment", { meta: { from, to } }, req.user.id);
  if (to && to !== req.user.id)
    await notify(to, {
      type: "lead", title: "Lead assigned to you",
      message: `${lead.name || lead.phone} – ${lead.propertyTitle || "lead"}`, data: { leadId: String(lead._id) },
    });
  await audit(req, "assign", "lead", lead._id, { assignedTo: [from, to] });
  return { ...lead, ...set };
}

// ----- Request schemas (zod) ----------------------------------------------------------------
const optEmail = z.preprocess((v) => (v === undefined ? undefined : str(v, 254).toLowerCase()),
  z.string().refine((e) => !e || EMAIL_RE.test(e), { error: "Enter a valid email address" }).optional());
const tagList = z.array(z.any(), { error: "tags must be a list" })
  .transform((tags) => [...new Set(tags.map((t) => str(t, 30).toLowerCase()).filter(Boolean))].slice(0, 20));
const budgetOrder = [
  (b) => b.budgetMin == null || b.budgetMax == null || b.budgetMin <= b.budgetMax,
  { error: "budgetMin can't be more than budgetMax", path: ["budgetMax"] },
];

const leadPatchSchema = z.object({
  status: oneOf(Lead.STATUSES, "status").optional(),
  lostReason: text(100).optional(),
  priority: oneOf(Lead.PRIORITIES, "priority").optional(),
  nextFollowUpAt: date("nextFollowUpAt").optional(),
  budgetMin: money("budgetMin").optional(),
  budgetMax: money("budgetMax").optional(),
  tags: tagList.optional(),
  name: text(80).optional(),
  city: text(80).optional(),
  email: optEmail,
}).refine((b) => b.status !== "lost" || !!b.lostReason, { error: "Give a lostReason when marking a lead lost", path: ["lostReason"] })
  .refine(...budgetOrder);

const MANUAL_SOURCES = ["manual", "call", "walk_in", "website"];
const createLeadSchema = z.object({
  phone: phoneField("Enter a valid 10-digit mobile number"),
  email: optEmail,
  source: oneOf(MANUAL_SOURCES, "source").default("manual"),
  priority: oneOf(Lead.PRIORITIES, "priority").default("warm"),
  name: text(80).optional(),
  city: text(80).optional(),
  purpose: text(20).optional(),
  propertyId: z.preprocess((v) => (v ? str(v, 40) : undefined), propertyIdField().optional()),
  assignedTo: z.union([z.string(), z.null()], { error: 'assignedTo must be a staff id, "me" or null' }).optional(),
  nextFollowUpAt: date("nextFollowUpAt").optional(),
  budgetMin: money("budgetMin").optional(),
  budgetMax: money("budgetMax").optional(),
  note: text(2000).optional(),
}).refine(...budgetOrder);

const ASSIGN_ERROR = 'assignedTo is required (a staff id, "me" or null)';
const assignSchema = z.object({ assignedTo: z.union([z.string(), z.null()], { error: ASSIGN_ERROR }) }, { error: ASSIGN_ERROR });

const BULK_ACTIONS = ["assign", "status", "priority", "tag", "delete"];
const IDS_ERROR = "ids must be a list of 1 to 200 lead ids";
const bulkSchema = z.object({
  ids: z.array(z.any(), { error: IDS_ERROR }).min(1, { error: IDS_ERROR }).max(200, { error: IDS_ERROR }),
  action: oneOf(BULK_ACTIONS, "action"),
  value: z.any().optional(),
  lostReason: z.any().optional(),
});

const DURATION_ERROR = "durationSeconds must be a whole number of seconds";
const activityPatchSchema = z.object({
  body: text(2000).optional(),
  outcome: z.enum(LeadActivity.OUTCOMES, { error: `outcome must be one of: ${LeadActivity.OUTCOMES.filter(Boolean).join(", ")}` }).optional(),
  scheduledAt: date("scheduledAt").optional(),
  completedAt: date("completedAt").optional(),
  durationSeconds: z.coerce.number({ error: DURATION_ERROR }).int({ error: DURATION_ERROR })
    .min(0, { error: DURATION_ERROR }).max(86400, { error: DURATION_ERROR }).optional(),
});
const activitySchema = activityPatchSchema.extend({
  type: oneOf(LeadActivity.MANUAL_TYPES, "type"),
  nextFollowUpAt: z.any().optional(), // validated by the lead patch
}).refine((a) => a.type !== "note" || !!a.body, { error: "Write the note", path: ["body"] });

const ENQUIRY_STATUSES = ["new", "contacted", "closed"];
const enquiryStatusSchema = z.object({ status: z.enum(ENQUIRY_STATUSES, { error: "status must be new, contacted or closed" }) });

const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Validates a lead patch and applies it. Status changes are logged and synced to enquiries.
async function applyPatch(req, lead, raw) {
  const b = validate(leadPatchSchema, raw);
  const set = defined({ ...b, lostReason: undefined });
  if (b.status !== undefined) {
    set.lostReason = b.status === "lost" ? b.lostReason : "";
    if (b.status !== "new" && !lead.firstResponseAt) set.firstResponseAt = new Date();
  }
  if (b.nextFollowUpAt !== undefined) set.followUpNotifiedFor = null;
  // Checked against what is stored too, for a patch that changes only one end of the budget.
  const min = set.budgetMin !== undefined ? set.budgetMin : lead.budgetMin;
  const max = set.budgetMax !== undefined ? set.budgetMax : lead.budgetMax;
  if (min != null && max != null && min > max) throw bad("budgetMin can't be more than budgetMax");
  if (!Object.keys(set).length) throw bad("Nothing to update");
  const changes = diff(lead, set);
  delete changes.followUpNotifiedFor;
  delete changes.firstResponseAt;
  set.lastActivityAt = new Date();
  await Lead.updateOne({ _id: lead._id }, { $set: set });
  let updated = { ...lead, ...set };
  if (set.status && set.status !== lead.status) {
    await logActivity(lead, "status_change", { meta: { from: lead.status, to: set.status, lostReason: set.lostReason || undefined } }, req.user.id);
    await syncEnquiries(updated);
  }
  updated = await refresh(updated, await getSettings());
  if (Object.keys(changes).length) await audit(req, "update", "lead", lead._id, changes);
  return updated;
}

async function removeLead(req, lead) {
  await LeadActivity.deleteMany({ lead: lead._id });
  await Lead.deleteOne({ _id: lead._id });
  await audit(req, "delete", "lead", lead._id, { name: [lead.name, null], phone: [lead.phone, null] });
}

// ----- Leads ------------------------------------------------------------------------------
const getLeads = (req, res) => listLeads(req, res);

const getLead = async (req, res) => {
  const lead = await findLead(req.params.id);
  const [account, property, enquiries, otherLeads, activities] = await Promise.all([
    lead.user ? findAccount(lead.user) : null,
    lead.property != null ? Property.findOne({ _id: propertyIdMatch(String(lead.property)) }).lean() : null,
    lead.enquiryIds?.length ? Enquiry.find({ _id: { $in: lead.enquiryIds } }).sort({ createdAt: -1 }).lean() : [],
    lead.user ? Lead.find({ user: lead.user, _id: { $ne: lead._id } }).sort({ lastActivityAt: -1 }).limit(20).lean() : [],
    LeadActivity.find({ lead: lead._id }).sort({ createdAt: -1, _id: -1 }).limit(10).lean(),
  ]);
  const [view] = await leadViews([lead]);
  res.json({
    lead: view,
    customer: account
      ? {
          ...accountView(account.doc, account.accountType),
          savedCount: (account.doc.savedProperties || []).length,
          listingCount: await Property.countDocuments({ ownerUserId: String(account.doc._id) }),
        }
      : null,
    property: property ? { ...normalizeProperty(property), approvalStatus: property.approvalStatus || "" } : null,
    enquiries: enquiries.map((e) => ({ id: String(e._id), message: e.message, status: e.status, createdAt: e.createdAt })),
    otherLeads: otherLeads.map((l) => ({ id: String(l._id), propertyTitle: l.propertyTitle, status: l.status, lastActivityAt: l.lastActivityAt })),
    recentActivities: await activityViews(activities),
  });
};

const createLead = async (req, res) => {
  const b = validate(createLeadSchema, req.body);
  const { phone, source, priority } = b;
  const email = b.email || "";

  let property = null;
  if (b.propertyId) {
    property = await Property.findOne({ _id: propertyIdMatch(b.propertyId) }).lean();
    if (!property) throw bad("Property not found", { errors: { propertyId: "Property not found" } });
  }
  const account = await findAccountByPhone(phone);
  if (account && property) {
    const existing = await Lead.findOne({ user: account.doc._id, property: property._id }).lean();
    if (existing) throw new AppError(409, "This customer already has a lead for this property", { existingLeadId: String(existing._id) });
  }
  const assignee = b.assignedTo ? await resolveAssignee(req, null, b.assignedTo) : null;
  const nextFollowUpAt = b.nextFollowUpAt || null;
  const budgetMin = b.budgetMin ?? null;
  const budgetMax = b.budgetMax ?? null;

  const now = new Date();
  const doc = {
    ...(account ? { user: account.doc._id } : {}),
    name: b.name || account?.doc.name || account?.doc.fullName || "",
    phone,
    email: email || account?.doc.email || "",
    city: b.city || account?.doc.city || "",
    purpose: b.purpose || account?.doc.purpose || "",
    ...(property ? { property: property._id, ...propertySnapshot(property) } : {}),
    sources: [source],
    primarySource: source,
    enquiryIds: [],
    viewCount: 0,
    status: "new",
    priority,
    tags: [],
    assignedTo: assignee ? oid(assignee) : null,
    ...(assignee ? { assignedAt: now } : {}),
    nextFollowUpAt,
    ...(budgetMin != null ? { budgetMin } : {}),
    ...(budgetMax != null ? { budgetMax } : {}),
    createdBy: oid(req.user.id),
    lastActivityAt: now,
    createdAt: now,
  };
  doc.score = scoreLead(doc, (await getSettings()).leads.scoreWeights);
  const lead = await Lead.create(doc);
  if (b.note) await logActivity(lead, "note", { body: b.note }, req.user.id);
  if (assignee && assignee !== req.user.id)
    await notify(assignee, {
      type: "lead", title: "Lead assigned to you",
      message: `${doc.name || phone} – ${doc.propertyTitle || "new lead"}`, data: { leadId: String(lead._id) },
    });
  await audit(req, "create", "lead", lead._id, { phone: [null, phone], source: [null, source] });
  const [view] = await leadViews([lead.toObject ? lead.toObject() : lead]);
  res.status(201).json({ lead: view });
};

const updateLead = async (req, res) => {
  const lead = await findLead(req.params.id);
  const [view] = await leadViews([await applyPatch(req, lead, req.body || {})]);
  res.json({ lead: view });
};

const deleteLead = async (req, res) => {
  await removeLead(req, await findLead(req.params.id));
  res.json({ deleted: true });
};

const assignLead = async (req, res) => {
  const lead = await findLead(req.params.id);
  const { assignedTo } = validate(assignSchema, req.body);
  const [view] = await leadViews([await assign(req, lead, assignedTo)]);
  res.json({ lead: view });
};

const bulkLeads = async (req, res) => {
  const { ids, action, value, lostReason } = validate(bulkSchema, req.body);
  if (action === "delete" && !isSuper(req)) throw new AppError(403, "Only a super admin can delete leads");
  let updated = 0;
  const failed = [];
  for (const id of [...new Set(ids.map(String))]) {
    try {
      const lead = await findLead(id);
      if (action === "assign") await assign(req, lead, value ?? null);
      else if (action === "status") await applyPatch(req, lead, { status: value, lostReason });
      else if (action === "priority") await applyPatch(req, lead, { priority: value });
      else if (action === "tag") await applyPatch(req, lead, { tags: [...(lead.tags || []), value] });
      else await removeLead(req, lead);
      updated += 1;
    } catch (e) {
      failed.push({ id, message: e.status && e.status < 500 ? e.message : "Something went wrong" });
    }
  }
  res.json({ updated, failed });
};

// ----- Activities -------------------------------------------------------------------------
const getActivities = async (req, res) => {
  const lead = await findLead(req.params.id);
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const types = list(req.query.type, LeadActivity.TYPES);
  const filter = { lead: lead._id, ...(types.length ? { type: { $in: types } } : {}) };
  const [items, total] = await Promise.all([
    LeadActivity.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    LeadActivity.countDocuments(filter),
  ]);
  res.json({ items: await activityViews(items), total, page, limit });
};

const addActivity = async (req, res) => {
  const lead = await findLead(req.params.id);
  const b = validate(activitySchema, req.body);
  const fields = defined({ ...b, type: undefined, nextFollowUpAt: undefined });
  const activity = await logActivity(lead, b.type, fields, req.user.id);

  const patch = {};
  if (b.nextFollowUpAt !== undefined) patch.nextFollowUpAt = b.nextFollowUpAt;
  // The first outreach on a new lead moves it to contacted.
  if (OUTREACH.includes(b.type) && lead.status === "new") patch.status = "contacted";
  const updated = Object.keys(patch).length
    ? await applyPatch(req, lead, patch)
    : (await Lead.updateOne({ _id: lead._id }, { $set: { lastActivityAt: new Date() } }), lead);
  const [view] = await leadViews([updated]);
  res.status(201).json({ activity: (await activityViews([activity.toObject ? activity.toObject() : activity]))[0], lead: view });
};

async function findOwnActivity(req) {
  const lead = await findLead(req.params.id);
  requireObjectId(req.params.activityId, "activity id");
  const a = await LeadActivity.findOne({ _id: oid(req.params.activityId), lead: lead._id }).lean();
  if (!a) throw new AppError(404, "Activity not found");
  if (!LeadActivity.MANUAL_TYPES.includes(a.type)) throw new AppError(403, "System entries can't be changed");
  if (!isSuper(req) && String(a.createdBy) !== req.user.id) throw new AppError(403, "Only the author or a super admin can change this entry");
  return a;
}

const updateActivity = async (req, res) => {
  const a = await findOwnActivity(req);
  const set = defined(validate(activityPatchSchema, req.body));
  if (!Object.keys(set).length) throw bad("Nothing to update");
  await LeadActivity.updateOne({ _id: a._id }, { $set: set });
  res.json({ activity: (await activityViews([{ ...a, ...set }]))[0] });
};

const deleteActivity = async (req, res) => {
  const a = await findOwnActivity(req);
  await LeadActivity.deleteOne({ _id: a._id });
  await audit(req, "delete", "lead_activity", a._id, { type: [a.type, null], body: [a.body, null] });
  res.json({ deleted: true });
};

// ----- Follow-ups -------------------------------------------------------------------------
const getFollowUps = async (req, res) => {
  const now = new Date();
  const when = str(req.query.when, 10) || "today";
  let from;
  let to;
  if (when === "overdue") [from, to] = [new Date(0), now];
  else if (when === "today") [from, to] = [istDayStart(now), istDayEnd(now)];
  else if (when === "week") [from, to] = [istDayStart(now), new Date(istDayStart(now).getTime() + 7 * DAY_MS - 1)];
  else if (when === "range") {
    from = optDate(req.query.from, "from");
    to = optDate(req.query.to, "to");
    if (!from || !to) throw bad("from and to are required when when=range");
  } else throw bad("when must be overdue, today, week or range");

  const who = str(req.query.assignedTo, 30) || (isSuper(req) ? "all" : "me");
  const assignee = who === "all" ? null : who === "me" ? req.user.id : requireObjectId(who, "assignedTo");
  const byAssignee = assignee ? { assignedTo: oid(assignee) } : {};
  const open = { status: { $nin: CLOSED } };

  const leads = await Lead.find({ ...byAssignee, ...open, nextFollowUpAt: { $gte: from, $lte: to } })
    .sort({ nextFollowUpAt: 1, _id: 1 }).limit(200).lean();
  const visits = await LeadActivity.find({
    type: { $in: ["site_visit", "meeting"] }, completedAt: null, scheduledAt: { $gte: from, $lte: to },
  }).sort({ scheduledAt: 1, _id: 1 }).limit(200).lean();
  const visitLeads = new Map((await Lead.find({ _id: { $in: visits.map((v) => v.lead) } }).lean()).map((l) => [String(l._id), l]));
  const myVisits = visits.filter((v) => {
    const l = visitLeads.get(String(v.lead));
    return l && !CLOSED.includes(l.status) && (!assignee || String(l.assignedTo) === assignee);
  });
  const visitViews = await activityViews(myVisits);
  res.json({
    leads: await leadViews(leads),
    visits: visitViews.map((v) => {
      const l = visitLeads.get(v.lead);
      return { ...v, leadName: l.name, leadPhone: l.phone, propertyTitle: l.propertyTitle };
    }),
  });
};

// ----- Export -----------------------------------------------------------------------------
const EXPORT_COLUMNS = [
  "id", "status", "priority", "score", "name", "phone", "email", "city", "purpose", "propertyId",
  "propertyTitle", "propertyLocation", "sources", "viewCount", "enquiryCount", "assignedTo",
  "nextFollowUpAt", "lostReason", "budgetMin", "budgetMax", "tags", "lastActivityAt", "createdAt",
];

// Quotes a CSV cell and defuses spreadsheet formulas (cells starting with = + - @).
function csvCell(v) {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const exportLeads = async (req, res) => {
  const format = str(req.query.format, 4) || "csv";
  if (!["csv", "json"].includes(format)) throw bad("format must be csv or json");
  const filter = leadFilter(req.query, req);
  const sort = SORTS[str(req.query.sort, 20)] || SORTS["-lastActivityAt"];
  const leads = await Lead.find(filter).sort(sort).limit(10000).lean();
  const rows = await leadViews(leads);
  await audit(req, "export", "lead", "", { format: [null, format], rows: [null, rows.length], filter: [null, req.query] });
  const stamp = new Date().toISOString().slice(0, 10);
  res.set("Content-Disposition", `attachment; filename="leads-${stamp}.${format}"`);
  if (format === "json") return res.json({ items: rows, total: rows.length });
  const flat = rows.map((r) => ({
    ...r,
    propertyId: r.property?.id || "",
    propertyTitle: r.property?.title || "",
    propertyLocation: r.property?.location || "",
    sources: r.sources.join("|"),
    tags: r.tags.join("|"),
    assignedTo: r.assignedTo?.name || "",
  }));
  const csv = [EXPORT_COLUMNS.join(","), ...flat.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\r\n");
  res.type("text/csv").send(csv);
};

// ----- Enquiries, views, reviews (raw lead sources) -----------------------------------------
const getEnquiries = async (req, res) => {
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const status = str(req.query.status, 12);
  const filter = ENQUIRY_STATUSES.includes(status) ? { status } : {};
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Enquiry.countDocuments(filter),
  ]);
  const leads = items.length ? await Lead.find({ enquiryIds: { $in: items.map((e) => e._id) } }).select("enquiryIds").lean() : [];
  const leadOf = new Map();
  leads.forEach((l) => (l.enquiryIds || []).forEach((e) => leadOf.set(String(e), String(l._id))));
  res.json({
    items: items.map((e) => ({
      id: String(e._id),
      leadId: leadOf.get(String(e._id)) || null,
      user: String(e.user),
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
    limit,
  });
};

const updateEnquiry = async (req, res) => {
  requireObjectId(req.params.id, "enquiry id");
  const { status } = validate(enquiryStatusSchema, req.body);
  const before = await Enquiry.findById(req.params.id).lean();
  if (!before) throw new AppError(404, "Enquiry not found");
  await Enquiry.updateOne({ _id: before._id }, { $set: { status } });
  await audit(req, "update", "enquiry", before._id, diff(before, { status }));
  res.json({ enquiry: { id: String(before._id), status } });
};

const getViews = async (req, res) => {
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const and = [];
  const search = str(req.query.search, 40);
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    and.push({ $or: [{ phone: re }, { name: re }, { propertyTitle: re }] });
  }
  const propertyId = str(req.query.propertyId, 40);
  if (propertyId) and.push({ property: propertyIdMatch(requirePropertyId(propertyId)) });
  const userId = str(req.query.userId, 30);
  if (userId) and.push({ user: oid(requireObjectId(userId, "userId")) });
  const minViews = Number(req.query.minViews);
  if (minViews > 0) and.push({ views: { $gte: minViews } });
  const filter = and.length ? { $and: and } : {};
  const [items, total] = await Promise.all([
    PropertyView.find(filter).sort({ lastViewedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    PropertyView.countDocuments(filter),
  ]);
  res.json({
    items: items.map((v) => ({
      id: String(v._id),
      user: String(v.user),
      phone: v.phone,
      name: v.name,
      email: v.email,
      city: v.city,
      purpose: v.purpose,
      property: String(v.property),
      propertyTitle: v.propertyTitle,
      propertyLocation: v.propertyLocation,
      views: v.views,
      firstViewedAt: v.firstViewedAt,
      lastViewedAt: v.lastViewedAt,
    })),
    total,
    page,
    limit,
  });
};

const deleteReview = async (req, res) => {
  requireObjectId(req.params.id, "review id");
  const r = await Review.findById(req.params.id).lean();
  if (!r) throw new AppError(404, "Review not found");
  await Review.deleteOne({ _id: req.params.id });
  await recompute(r.property);
  await audit(req, "delete", "review", r._id, { rating: [r.rating, null], comment: [r.comment, null] });
  res.json({ deleted: true });
};

module.exports = {
  leadFilter, listLeads, leadViews,
  getLeads, getLead, createLead, updateLead, deleteLead, assignLead, bulkLeads,
  getActivities, addActivity, updateActivity, deleteActivity, getFollowUps, exportLeads,
  getEnquiries, updateEnquiry, getViews, deleteReview,
};
