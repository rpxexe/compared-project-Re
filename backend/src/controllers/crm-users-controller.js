const mongoose = require("mongoose");
const { SignUpUser, Lead, Enquiry, PropertyView, Property, Review } = require("../models");
const { AppError, bad } = require("../utils/errors");
const { str, escapeRegex, paging, requireObjectId, cleanPhone, isValidPhone } = require("../utils/validate");
const {
  STAFF_ROLES, MODELS, findAccount, accountView, findStaff, activeSuperadminIds, findActiveStaff,
} = require("../utils/accounts");
const { countBy } = require("../utils/countBy");
const { audit, diff } = require("../utils/audit");
const { notify } = require("../utils/notify");
const { optDate } = require("../utils/dates");
const { hashPassword, verifyPassword, validPassword } = require("../utils/password");
const { CLOSED } = require("../utils/leads");
const { listLeads, leadViews } = require("./crm-leads-controller");
const { propertyItems } = require("./crm-properties-controller");
const { z, validate, text, email: emailField, oneOf } = require("../utils/zod");

const PASSWORD_ERROR = "Password must be between 8 and 128 characters";
const password = () => z.string({ error: PASSWORD_ERROR }).refine(validPassword, { error: PASSWORD_ERROR });
const fullName = () => z.preprocess((v) => str(v, 60), z.string().min(2, { error: "Enter the full name" }));
const optPhone = () => z.preprocess((v) => (v ? cleanPhone(v) : ""),
  z.string().refine((p) => !p || isValidPhone(p), { error: "Enter a valid 10-digit mobile number" }));

const passwordChangeSchema = z.object({ currentPassword: z.any().optional(), newPassword: password() });
const accountSchema = (Model) => z.object({
  role: oneOf(Model.ROLES, "Role").optional(),
  isActive: z.boolean({ error: "isActive must be true or false" }).optional(),
});
const NOTIFY_TYPES = ["info", "property", "price"];
const notifySchema = z.object({
  type: oneOf(NOTIFY_TYPES, "type").default("info"),
  title: z.preprocess((v) => str(v, 120), z.string().min(1, { error: "title and message are required" })),
  message: z.preprocess((v) => str(v, 1000), z.string().min(1, { error: "title and message are required" })),
  data: z.looseObject({ propertyId: text(40).optional() }).optional().catch(undefined),
});
const createStaffSchema = z.object({
  fullName: fullName(),
  email: emailField(),
  phone: optPhone(),
  role: z.enum(STAFF_ROLES, { error: "role must be admin or superadmin" }),
  password: password(),
});
const updateStaffSchema = z.object({
  fullName: fullName().optional(),
  phone: optPhone().optional(),
  role: z.any().optional(), // checked against the account's own role list
  isActive: z.any().optional(),
});
const resetPasswordSchema = z.object({ password: password() });
const deactivateSchema = z.object({ reassignTo: z.preprocess((v) => (v ? str(v, 30) : null), z.string().nullable()) });

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const isSuper = (req) => req.user.role === "superadmin";

// ----- Me ---------------------------------------------------------------------------------
const PERMISSIONS = {
  admin: ["leads:read", "leads:write", "leads:assign:self", "properties:moderate", "properties:create", "reviews:delete", "users:read"],
  superadmin: [
    "leads:read", "leads:write", "leads:assign:any", "leads:delete", "properties:moderate", "properties:create",
    "properties:delete", "reviews:delete", "users:read", "users:manage", "staff:manage", "export", "audit:read", "settings:write",
  ],
};

const getMe = async (req, res) => {
  const account = await findAccount(req.user.id);
  if (!account) throw new AppError(404, "User not found");
  res.json({ user: accountView(account.doc, account.accountType), permissions: PERMISSIONS[req.user.role] || [] });
};

const changeMyPassword = async (req, res) => {
  const account = await findAccount(req.user.id);
  if (!account || account.accountType !== "email") throw bad("This account signs in with a phone OTP and has no password");
  const { currentPassword, newPassword } = validate(passwordChangeSchema, req.body);
  const full = await SignUpUser.findById(req.user.id);
  if (!(await verifyPassword(String(currentPassword || ""), full.password))) throw new AppError(401, "Current password is incorrect");
  await SignUpUser.updateOne({ _id: full._id }, { $set: { password: await hashPassword(newPassword) } });
  await audit(req, "change_password", "staff", req.user.id);
  res.json({ message: "Password updated" });
};

// ----- Customers --------------------------------------------------------------------------
const SORT_FIELDS = { "-createdAt": "createdAt", "-lastLoginAt": "lastLoginAt" };

// Per-collection filter: phone accounts keep the name in `name`, email accounts in `fullName`
// and have no purpose/city, so those filters only match phone accounts.
function userFilter(q, accountType) {
  const and = [];
  const search = str(q.search, 60);
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    and.push({ $or: accountType === "phone" ? [{ phone: re }, { name: re }] : [{ phone: re }, { fullName: re }, { email: re }] });
  }
  const role = str(q.role, 12);
  if (role) and.push({ role });
  if (q.isActive === "true") and.push({ isActive: { $ne: false } });
  if (q.isActive === "false") and.push({ isActive: false });
  const purpose = str(q.purpose, 20);
  const city = str(q.city, 60);
  if (accountType === "email" && (purpose || city)) return null;
  if (purpose) and.push({ purpose });
  if (city) and.push({ city: new RegExp(escapeRegex(city), "i") });
  const from = optDate(q.from, "from");
  const to = optDate(q.to, "to");
  if (from || to) and.push({ createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } });
  return and.length ? { $and: and } : {};
}

async function withCounts(rows) {
  const ids = rows.map((r) => r.doc._id);
  const [leads, listings] = await Promise.all([
    countBy(Lead, "user", ids),
    countBy(Property, "ownerUserId", ids.map(String)),
  ]);
  return rows.map(({ doc, accountType }) => ({
    ...accountView(doc, accountType),
    leadCount: leads.get(String(doc._id)) || 0,
    listingCount: listings.get(String(doc._id)) || 0,
  }));
}

// Lists both account collections as one, merged by the sort date.
const getUsers = async (req, res) => {
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const type = str(req.query.accountType, 6);
  const field = SORT_FIELDS[str(req.query.sort, 20)] || "createdAt";
  const sources = MODELS()
    .filter(([, t]) => !type || t === type)
    .map(([Model, accountType]) => ({ Model, accountType, filter: userFilter(req.query, accountType) }))
    .filter((s) => s.filter);
  const results = await Promise.all(sources.map(async ({ Model, accountType, filter }) => {
    const [docs, total] = await Promise.all([
      Model.find(filter).sort({ [field]: -1, _id: -1 }).limit(skip + limit).lean(),
      Model.countDocuments(filter),
    ]);
    return { rows: docs.map((doc) => ({ doc, accountType })), total };
  }));
  const time = (r) => new Date(r.doc[field] || 0).getTime();
  const merged = results.flatMap((r) => r.rows).sort((a, b) => time(b) - time(a) || String(b.doc._id).localeCompare(String(a.doc._id)));
  res.json({
    items: await withCounts(merged.slice(skip, skip + limit)),
    total: results.reduce((n, r) => n + r.total, 0),
    page,
    limit,
  });
};

async function findUserOr404(id) {
  requireObjectId(id, "user id");
  const account = await findAccount(id);
  if (!account) throw new AppError(404, "User not found");
  return account;
}

const getUser = async (req, res) => {
  const { doc, accountType } = await findUserOr404(req.params.id);
  const id = doc._id;
  const [[item], leads, enquiries, views, listings, reviews, recentLeads, recentViews] = await Promise.all([
    withCounts([{ doc, accountType }]),
    Lead.countDocuments({ user: id }),
    Enquiry.countDocuments({ user: id }),
    PropertyView.countDocuments({ user: id }),
    Property.countDocuments({ ownerUserId: String(id) }),
    Review.countDocuments({ user: id }),
    Lead.find({ user: id }).sort({ lastActivityAt: -1, _id: -1 }).limit(5).lean(),
    PropertyView.find({ user: id }).sort({ lastViewedAt: -1, _id: -1 }).limit(5).lean(),
  ]);
  res.json({
    user: item,
    counts: { leads, enquiries, views, saved: (doc.savedProperties || []).length, listings, reviews },
    recentLeads: await leadViews(recentLeads),
    recentViews: recentViews.map((v) => ({
      property: String(v.property), propertyTitle: v.propertyTitle, propertyLocation: v.propertyLocation,
      views: v.views, lastViewedAt: v.lastViewedAt,
    })),
  });
};

// Blocks changes that would leave no active super admin.
async function guardLastSuperadmin(doc, nextRole, nextActive) {
  const losing = doc.role === "superadmin" && doc.isActive !== false && (nextRole !== "superadmin" || nextActive === false);
  if (losing && (await activeSuperadminIds()).length <= 1)
    throw bad("There must be at least one active super admin");
}

// Role / active status for any account. Shared by the users and staff endpoints.
async function updateAccount(req, account, raw, extra = {}) {
  const { doc, Model } = account;
  if (String(doc._id) === req.user.id && (raw.role !== undefined || raw.isActive !== undefined))
    throw bad("You cannot change your own role or status");
  const b = validate(accountSchema(Model), raw);
  const set = { ...extra };
  if (b.role !== undefined) set.role = b.role;
  if (b.isActive !== undefined) set.isActive = b.isActive;
  if (!Object.keys(set).length) throw bad("Nothing to update");
  await guardLastSuperadmin(doc, set.role ?? doc.role, set.isActive ?? doc.isActive);
  const updated = await Model.findOneAndUpdate({ _id: doc._id }, { $set: set }, { new: true }).lean();
  await audit(req, "update", STAFF_ROLES.includes(doc.role) || STAFF_ROLES.includes(set.role) ? "staff" : "user", doc._id, diff(doc, set));
  return updated;
}

const updateUser = async (req, res) => {
  const account = await findUserOr404(req.params.id);
  const b = req.body || {};
  const updated = await updateAccount(req, account, { role: b.role, isActive: b.isActive });
  res.json({ user: accountView(updated, account.accountType) });
};

const getUserLeads = async (req, res) => {
  const { doc } = await findUserOr404(req.params.id);
  await listLeads(req, res, { userId: String(doc._id) });
};

const getUserProperties = async (req, res) => {
  const { doc } = await findUserOr404(req.params.id);
  const { page, limit, skip } = paging(req.query, { defLimit: 20, maxLimit: 50 });
  const filter = { ownerUserId: String(doc._id) };
  const [docs, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  res.json({ items: await propertyItems(docs), total, page, limit });
};

const notifyUser = async (req, res) => {
  const { doc } = await findUserOr404(req.params.id);
  const { type, title, message, data: raw } = validate(notifySchema, req.body, "title and message are required");
  const data = raw?.propertyId ? { propertyId: raw.propertyId } : {};
  await notify(String(doc._id), { type, title, message, data });
  await audit(req, "notify", "user", doc._id, { title: [null, title] });
  res.status(201).json({ sent: true });
};

// ----- Staff ------------------------------------------------------------------------------
const staffView = (doc, accountType, openLeads) => ({
  id: String(doc._id),
  name: doc.name || doc.fullName || "",
  email: doc.email || "",
  phone: doc.phone || "",
  role: doc.role,
  accountType,
  isActive: doc.isActive !== false,
  lastLoginAt: doc.lastLoginAt || null,
  createdAt: doc.createdAt || null,
  openLeads,
});

// Admins get the short list (for "assign to"); super admins get the full records.
const getStaff = async (req, res) => {
  const filter = {};
  if (req.query.isActive === "true") filter.isActive = { $ne: false };
  if (req.query.isActive === "false") filter.isActive = false;
  const role = str(req.query.role, 12);
  if (STAFF_ROLES.includes(role)) filter.role = role;
  const staff = await findStaff(isSuper(req) ? filter : { ...filter, isActive: { $ne: false } });
  if (!isSuper(req))
    return res.json({ items: staff.map(({ doc }) => ({ id: String(doc._id), name: doc.name || doc.fullName || "", role: doc.role })) });
  const open = await countBy(Lead, "assignedTo", staff.map((s) => s.doc._id), { status: { $nin: CLOSED } });
  res.json({ items: staff.map(({ doc, accountType }) => staffView(doc, accountType, open.get(String(doc._id)) || 0)) });
};

const createStaff = async (req, res) => {
  const b = validate(createStaffSchema, req.body);
  const { email, phone } = b;
  if (await SignUpUser.findOne({ email }).lean()) throw new AppError(409, "An account with this email already exists");
  const created = await SignUpUser.create({
    fullName: b.fullName, email, phone, role: b.role, password: await hashPassword(b.password), isActive: true, createdAt: new Date(),
  });
  const doc = created.toObject ? created.toObject() : created;
  await audit(req, "create", "staff", doc._id, { email: [null, email], role: [null, b.role] });
  res.status(201).json({ staff: staffView(doc, "email", 0) });
};

async function findStaffOr404(id) {
  requireObjectId(id, "staff id");
  const account = await findAccount(id);
  if (!account || !STAFF_ROLES.includes(account.doc.role)) throw new AppError(404, "Staff member not found");
  return account;
}

const updateStaff = async (req, res) => {
  const account = await findStaffOr404(req.params.id);
  const b = validate(updateStaffSchema, req.body);
  const extra = {};
  if (b.fullName !== undefined) extra[account.accountType === "email" ? "fullName" : "name"] = b.fullName;
  if (b.phone !== undefined) {
    if (account.accountType === "phone") throw bad("The phone number of an OTP account is its login and can't be changed");
    extra.phone = b.phone;
  }
  const updated = await updateAccount(req, account, { role: b.role, isActive: b.isActive }, extra);
  res.json({ staff: staffView(updated, account.accountType) });
};

const resetStaffPassword = async (req, res) => {
  const account = await findStaffOr404(req.params.id);
  if (account.accountType !== "email") throw bad("This account signs in with a phone OTP and has no password");
  const { password: next } = validate(resetPasswordSchema, req.body);
  await SignUpUser.updateOne({ _id: account.doc._id }, { $set: { password: await hashPassword(next) } });
  await audit(req, "reset_password", "staff", account.doc._id);
  res.json({ message: "Password reset" });
};

// Staff are deactivated, never deleted, so the audit trail keeps pointing at them.
const deactivateStaff = async (req, res) => {
  const account = await findStaffOr404(req.params.id);
  const { reassignTo } = validate(deactivateSchema, req.body);
  if (reassignTo && (reassignTo === String(account.doc._id) || !(await findActiveStaff(reassignTo))))
    throw bad("reassignTo must be another active staff member");
  await updateAccount(req, account, { isActive: false });
  const moved = await Lead.updateMany(
    { assignedTo: account.doc._id, status: { $nin: CLOSED } },
    { $set: { assignedTo: reassignTo ? oid(reassignTo) : null, assignedAt: new Date() } },
  );
  res.json({ deactivated: true, leadsMoved: moved.modifiedCount ?? moved.matchedCount ?? 0, reassignedTo: reassignTo });
};

module.exports = {
  getMe, changeMyPassword,
  getUsers, getUser, updateUser, getUserLeads, getUserProperties, notifyUser,
  getStaff, createStaff, updateStaff, resetStaffPassword, deactivateStaff,
};
