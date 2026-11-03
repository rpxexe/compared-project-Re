const mongoose = require("mongoose");
const { User, SignUpUser, Property, Enquiry, Review, PropertyView, Lead, AuditLog } = require("../models");
const { bad } = require("../utils/errors");
const { str, paging, requireObjectId } = require("../utils/validate");
const { istDayStart, istDayEnd, bucketKey, optDate, DAY_MS } = require("../utils/dates");
const { findStaff, namesById } = require("../utils/accounts");
const { getSettings, saveSettings } = require("../utils/crmSettings");
const { audit, diff } = require("../utils/audit");
const { CLOSED } = require("../utils/leads");

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const accounts = () => [User, SignUpUser].filter(Boolean);

const getStats = async (req, res) => {
  const now = new Date();
  const open = { status: { $nin: CLOSED } };
  const today = { ...open, nextFollowUpAt: { $gte: istDayStart(now), $lte: istDayEnd(now) } };
  const overdue = { ...open, nextFollowUpAt: { $lt: now } };
  const me = { assignedTo: oid(req.user.id) };
  const [userCounts, properties, manual, pending, enquiries, newEnquiries, reviews, views, leads, byStatus,
    unassigned, dueToday, overdueCount, myOpen, myDueToday] = await Promise.all([
    Promise.all(accounts().map((M) => M.countDocuments({}))),
    Property.countDocuments({}),
    Property.countDocuments({ dataSource: "manual" }),
    Property.countDocuments({ approvalStatus: "pending" }),
    Enquiry.countDocuments({}),
    Enquiry.countDocuments({ status: "new" }),
    Review.countDocuments({}),
    PropertyView.countDocuments({}),
    Lead.countDocuments({}),
    Promise.all(Lead.STATUSES.map((s) => Lead.countDocuments({ status: s }))),
    Lead.countDocuments({ ...open, assignedTo: null }),
    Lead.countDocuments(today),
    Lead.countDocuments(overdue),
    Lead.countDocuments({ ...open, ...me }),
    Lead.countDocuments({ ...today, ...me }),
  ]);
  res.json({
    users: userCounts.reduce((a, b) => a + b, 0),
    properties,
    manualProperties: manual,
    pendingApprovals: pending,
    enquiries,
    newEnquiries,
    reviews,
    views,
    leads: {
      total: leads,
      byStatus: Object.fromEntries(Lead.STATUSES.map((s, i) => [s, byStatus[i]])),
      unassigned,
      followUpsDueToday: dueToday,
      overdueFollowUps: overdueCount,
    },
    myLeads: { open: myOpen, followUpsDueToday: myDueToday },
  });
};

// metric -> [models, date field, fields usable for groupBy]
const METRICS = {
  leads: [() => [Lead], "createdAt", { source: "primarySource", status: "status", city: "city" }],
  enquiries: [() => [Enquiry], "createdAt", { status: "status" }],
  users: [accounts, "createdAt", { city: "city" }],
  properties: [() => [Property], "createdAt", { status: "approvalStatus", city: "city" }],
  views: [() => [PropertyView], "firstViewedAt", { city: "city" }],
};
const MAX_ROWS = 100000;

const getTrends = async (req, res) => {
  const metric = str(req.query.metric, 12) || "leads";
  if (!METRICS[metric]) throw bad(`metric must be one of: ${Object.keys(METRICS).join(", ")}`);
  const interval = str(req.query.interval, 6) || "day";
  if (!["day", "week", "month"].includes(interval)) throw bad("interval must be day, week or month");
  const to = optDate(req.query.to, "to") || new Date();
  const from = optDate(req.query.from, "from") || new Date(istDayStart(to).getTime() - 29 * DAY_MS);
  if (from > to) throw bad("from must be before to");
  if (to - from > 731 * DAY_MS) throw bad("Choose a range of two years or less");
  const [models, dateField, groups] = METRICS[metric];
  const groupBy = str(req.query.groupBy, 10);
  if (groupBy && !groups[groupBy]) throw bad(`groupBy for ${metric} must be one of: ${Object.keys(groups).join(", ")}`);
  const groupField = groups[groupBy];

  const points = new Map();
  for (let t = istDayStart(from).getTime(); t <= to.getTime(); t += DAY_MS) {
    const key = bucketKey(new Date(t), interval);
    if (!points.has(key)) points.set(key, { date: key, value: 0, ...(groupField ? { groups: {} } : {}) });
  }
  for (const Model of models()) {
    const rows = await Model.find({ [dateField]: { $gte: from, $lte: to } })
      .select(`${dateField}${groupField ? ` ${groupField}` : ""}`).limit(MAX_ROWS).lean();
    for (const r of rows) {
      const p = points.get(bucketKey(r[dateField], interval));
      if (!p) continue;
      p.value += 1;
      if (groupField) {
        const g = String(r[groupField] || "unknown");
        p.groups[g] = (p.groups[g] || 0) + 1;
      }
    }
  }
  res.json({ metric, interval, from, to, groupBy: groupBy || null, points: [...points.values()] });
};

const getStaffPerformance = async (req, res) => {
  const from = optDate(req.query.from, "from");
  const to = optDate(req.query.to, "to");
  const range = from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
  const staff = await findStaff();
  const now = new Date();
  const items = await Promise.all(staff.map(async ({ doc }) => {
    const leads = await Lead.find({ assignedTo: doc._id, ...range }).select("status createdAt firstResponseAt nextFollowUpAt").lean();
    const responded = leads.filter((l) => l.firstResponseAt && l.createdAt);
    const avg = responded.length
      ? Math.round(responded.reduce((n, l) => n + (new Date(l.firstResponseAt) - new Date(l.createdAt)), 0) / responded.length / 60000)
      : null;
    return {
      staffId: String(doc._id),
      name: doc.name || doc.fullName || "",
      role: doc.role,
      isActive: doc.isActive !== false,
      assigned: leads.length,
      contacted: leads.filter((l) => l.status !== "new").length,
      won: leads.filter((l) => l.status === "won").length,
      lost: leads.filter((l) => l.status === "lost").length,
      avgFirstResponseMinutes: avg,
      overdueFollowUps: leads.filter((l) => !CLOSED.includes(l.status) && l.nextFollowUpAt && new Date(l.nextFollowUpAt) < now).length,
    };
  }));
  res.json({ items });
};

// ----- Audit log & settings -----------------------------------------------------------------
const ENTITIES = ["lead", "lead_activity", "property", "user", "staff", "enquiry", "review", "settings"];

const getAuditLog = async (req, res) => {
  const { page, limit, skip } = paging(req.query, { defLimit: 50, maxLimit: 100 });
  const filter = {};
  const actor = str(req.query.actor, 30);
  if (actor) filter.actor = oid(requireObjectId(actor, "actor"));
  const entity = str(req.query.entity, 20);
  if (entity) {
    if (!ENTITIES.includes(entity)) throw bad(`entity must be one of: ${ENTITIES.join(", ")}`);
    filter.entity = entity;
  }
  const entityId = str(req.query.entityId, 40);
  if (entityId) filter.entityId = entityId;
  const action = str(req.query.action, 30);
  if (action) filter.action = action;
  const from = optDate(req.query.from, "from");
  const to = optDate(req.query.to, "to");
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const names = await namesById(items.map((a) => a.actor));
  res.json({
    items: items.map((a) => ({
      id: String(a._id),
      actor: { id: String(a.actor), name: names.get(String(a.actor)) || "", role: a.actorRole },
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      changes: a.changes || {},
      ip: a.ip,
      createdAt: a.createdAt,
    })),
    total,
    page,
    limit,
  });
};

const getCrmSettings = async (req, res) => {
  res.json({ settings: await getSettings() });
};

const updateCrmSettings = async (req, res) => {
  const before = await getSettings();
  const settings = await saveSettings(req.body || {});
  await audit(req, "update", "settings", "global", diff(before, settings));
  res.json({ settings });
};

module.exports = {
  getStats, getTrends, getStaffPerformance, getAuditLog, getCrmSettings, updateCrmSettings,
};
