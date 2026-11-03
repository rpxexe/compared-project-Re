// CRM lead bookkeeping. Enquiries, views and saves in the app upsert one lead per
// (customer, listing); staff actions go through the same helpers so history stays consistent.
const mongoose = require("mongoose");
const env = require("../config/env");
const { Lead, LeadActivity, Enquiry } = require("../models");
const { normalizeProperty } = require("./property");
const { getSettings } = require("./crmSettings");
const { notify } = require("./notify");
const { activeStaffIds, activeSuperadminIds, findAccountByPhone } = require("./accounts");
const { countBy } = require("./countBy");

const CLOSED = ["won", "lost"];
const OUTREACH = ["call", "whatsapp", "email", "sms"];
// Lead status -> the status of its enquiries, so the enquiry list stays in step with the CRM.
const ENQUIRY_STATUS = {
  new: "new", contacted: "contacted", qualified: "contacted", site_visit: "contacted",
  negotiation: "contacted", won: "closed", lost: "closed",
};

// Signals known at write time; the score is recalculated whenever the lead changes.
function scoreLead(lead, w) {
  const sources = lead.sources || [];
  let s = 0;
  if (sources.includes("enquiry")) s += w.enquiry;
  s += Math.min(lead.viewCount || 0, 10) * w.view;
  if (sources.includes("saved")) s += w.saved;
  if (["buyer", "investor"].includes(lead.purpose)) s += w.purpose;
  if (lead.lastActivityAt && Date.now() - new Date(lead.lastActivityAt).getTime() < 7 * 86400000) s += w.recent;
  return Math.max(0, Math.min(100, s));
}

function propertySnapshot(doc) {
  const p = normalizeProperty(doc);
  return {
    propertyTitle: p.title || "",
    propertyLocation: [p.locality, p.city].filter(Boolean).join(", "),
    propertyPrice: p.price || "",
  };
}

// Contact details of the signed-in customer; blanks never overwrite what staff entered.
function contactSnapshot(user, account) {
  const c = {
    name: user.name || account?.name || account?.fullName || "",
    phone: user.phone || account?.phone || "",
    email: account?.email || "",
    city: account?.city || "",
    purpose: account?.purpose || "",
  };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v));
}

const logActivity = (lead, type, fields = {}, actor = null) =>
  LeadActivity.create({
    lead: lead._id || lead, type, body: "", outcome: "", meta: {}, scheduledAt: null, completedAt: null,
    ...fields, createdBy: actor, createdAt: new Date(),
  });

// Least-loaded active staff member (fewest open leads); ties go to the oldest account.
async function pickAssignee() {
  const ids = await activeStaffIds();
  if (!ids.length) return null;
  const open = await countBy(Lead, "assignedTo", ids.map((id) => new mongoose.Types.ObjectId(id)), { status: { $nin: CLOSED } });
  return ids.reduce((best, id) => ((open.get(id) || 0) < (open.get(best) || 0) ? id : best), ids[0]);
}

// Recalculates the score and, when enabled, auto-assigns an unassigned open lead.
async function refresh(lead, settings) {
  const set = { score: scoreLead(lead, settings.leads.scoreWeights) };
  if (!lead.assignedTo && settings.leads.autoAssign === "least_loaded" && !CLOSED.includes(lead.status)) {
    const to = await pickAssignee();
    if (to) {
      set.assignedTo = new mongoose.Types.ObjectId(to);
      set.assignedAt = new Date();
      await logActivity(lead, "assignment", { meta: { from: null, to, auto: true } });
      await notify(to, {
        type: "lead", title: "New lead assigned",
        message: `${lead.name || lead.phone} – ${lead.propertyTitle}`, data: { leadId: String(lead._id) },
      });
    }
  }
  await Lead.updateOne({ _id: lead._id }, { $set: set });
  return { ...lead, ...set };
}

// Upserts the (customer, listing) lead. Returns null when `createIf` is false and no lead exists.
async function upsertLead({ user, account, property, source, set = {}, addEnquiry, createIf = true }) {
  const filter = { user: new mongoose.Types.ObjectId(user.id), property: property._id };
  const existing = await Lead.findOne(filter).lean();
  if (!existing && !createIf) return null;
  const update = {
    $set: { ...contactSnapshot(user, account), ...propertySnapshot(property), lastActivityAt: new Date(), ...set },
    $addToSet: { sources: source, ...(addEnquiry ? { enquiryIds: addEnquiry } : {}) },
    $setOnInsert: {
      primarySource: source, status: "new", assignedTo: null, nextFollowUpAt: null, score: 0,
      ...(set.priority ? {} : { priority: "warm" }),
      ...(set.viewCount === undefined ? { viewCount: 0 } : {}),
    },
  };
  let lead;
  try {
    lead = await Lead.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (e) {
    if (e.code !== 11000) throw e;
    lead = await Lead.findOneAndUpdate(filter, update, { new: true }).lean(); // lost an insert race
  }
  return { lead, created: !existing, before: existing };
}

// App-event hooks. A CRM problem must never fail the customer's request.
const guard = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    if (!env.isTest) console.error("CRM lead update failed:", e.message);
    return null;
  }
};

// After a customer reaches out: reopen a lost lead, rescore, and tell whoever owns it (or the
// super admins when nobody does).
async function afterEnquiry(lead, before, settings) {
  if (before?.status === "lost") {
    await Lead.updateOne({ _id: lead._id }, { $set: { status: "new", lostReason: "" } });
    await logActivity(lead, "status_change", { meta: { from: "lost", to: "new", reason: "new_enquiry" } });
    lead = { ...lead, status: "new", lostReason: "" };
  }
  lead = await refresh(lead, settings);
  const to = lead.assignedTo ? [String(lead.assignedTo)] : await activeSuperadminIds();
  await notify(to, {
    type: "lead", title: "New enquiry",
    message: `${lead.name || lead.phone} enquired about ${lead.propertyTitle || "a property"}`, data: { leadId: String(lead._id) },
  });
  return lead;
}

const onEnquiry = guard(async ({ user, account, property, enquiry }) => {
  const settings = await getSettings();
  const res = await upsertLead({ user, account, property, source: "enquiry", set: { priority: "hot" }, addEnquiry: enquiry._id });
  await logActivity(res.lead, "enquiry", { body: enquiry.message || "", meta: { enquiryId: String(enquiry._id) } });
  return afterEnquiry(res.lead, res.before, settings);
});

// Contact form (POST /api/v2/leads/customer). Anyone can submit one, so the lead is linked to an
// app account only through a matching phone number; otherwise it stands alone.
const onFormLead = guard(async ({ form, property, customerLeadId }) => {
  const settings = await getSettings();
  const account = await findAccountByPhone(form.customerPhone);
  let lead;
  let before = null;
  if (account && property) {
    const res = await upsertLead({
      user: { id: String(account.doc._id), name: form.customerName, phone: form.customerPhone },
      account: { ...account.doc, email: form.customerEmail, city: form.city || account.doc.city, purpose: form.userType || account.doc.purpose },
      property,
      source: "form",
      set: { priority: "hot" },
    });
    ({ lead, before } = res);
  } else {
    const now = new Date();
    const created = await Lead.create({
      ...(account ? { user: account.doc._id } : {}),
      name: form.customerName,
      phone: form.customerPhone,
      email: form.customerEmail,
      city: form.city || "",
      purpose: form.userType || "",
      ...(property ? { property: property._id, ...propertySnapshot(property) } : {}),
      sources: ["form"], primarySource: "form", enquiryIds: [], viewCount: 0, status: "new", priority: "hot",
      tags: [], assignedTo: null, nextFollowUpAt: null, score: 0, lastActivityAt: now, createdAt: now,
    });
    lead = created.toObject ? created.toObject() : created;
  }
  const details = [
    form.message,
    form.budget && `Budget: ${form.budget}`,
    form.propertyType && `Looking for: ${form.propertyType}`,
    [form.locality, form.city].filter(Boolean).join(", ") && `Location: ${[form.locality, form.city].filter(Boolean).join(", ")}`,
    form.loanInterest && "Interested in a home loan",
  ].filter(Boolean).join("\n");
  await logActivity(lead, "enquiry", { body: details, meta: { form: form.source, customerLeadId: String(customerLeadId) } });
  return afterEnquiry(lead, before, settings);
});

const onView = guard(async ({ user, account, property, views }) => {
  const settings = await getSettings();
  const res = await upsertLead({
    user, account, property, source: "view", set: { viewCount: views }, createIf: views >= settings.leads.viewThreshold,
  });
  if (!res) return null;
  if (res.created) await logActivity(res.lead, "view", { meta: { views } });
  return refresh(res.lead, settings);
});

const onSave = guard(async ({ user, account, property }) => {
  const settings = await getSettings();
  const res = await upsertLead({ user, account, property, source: "saved" });
  return refresh(res.lead, settings);
});

async function syncEnquiries(lead) {
  if (lead.enquiryIds?.length)
    await Enquiry.updateMany({ _id: { $in: lead.enquiryIds } }, { $set: { status: ENQUIRY_STATUS[lead.status] } });
}

module.exports = {
  CLOSED, OUTREACH, scoreLead, propertySnapshot, logActivity, refresh, upsertLead,
  onEnquiry, onView, onSave, onFormLead, syncEnquiries,
};
