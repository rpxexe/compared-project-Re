// POST /api/v2/leads/customer: contact / enquiry forms, as in the mobile API contract. Public (no
// auth), deduplicated per email + property for 24 hours, and fed into the CRM as a lead.
const { CustomerLead, Property } = require("../models");
const { isPropertyId, propertyIdMatch } = require("../utils/validate");
const { onFormLead } = require("../utils/leads");
const { z } = require("zod");

const DAY_MS = 24 * 60 * 60 * 1000;

const text = (max) => z.string({ error: "Expected string" }).trim().max(max, { error: `Must be at most ${max} characters` }).nullish();
const flag = () => z.boolean({ error: "Expected boolean" }).optional();

// The website's lead schema. Unknown fields are stripped; errors flatten to the contract's
// { formErrors, fieldErrors: { field: [messages] } }.
const leadSchema = z.object({
  customerName: z.string({ error: "Name must be at least 2 characters" }).trim().min(2, { error: "Name must be at least 2 characters" }).max(100),
  customerEmail: z.email({ error: "Invalid email address" }).max(254).transform((e) => e.toLowerCase()),
  customerPhone: z.string({ error: "Invalid 10-digit Indian mobile number" }).regex(/^[6-9]\d{9}$/, { error: "Invalid 10-digit Indian mobile number" }),
  source: z.enum(CustomerLead.SOURCES, { error: `Source must be one of: ${CustomerLead.SOURCES.join(", ")}` }),
  propertyId: text(40),
  propertyTitle: text(200),
  userType: z.enum(["buyer", "investor"], { error: "User type must be buyer or investor" }).nullish(),
  budget: text(100),
  propertyType: text(100),
  locality: text(100),
  city: text(100),
  message: z.string({ error: "Expected string" }).max(1000, { error: "Message must be at most 1000 characters" }).optional(),
  loanInterest: flag(),
  customerContactConsent: flag(),
});

const createCustomerLead = async (req, res) => {
  const parsed = leadSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ success: false, message: "Validation failed", errors: z.flattenError(parsed.error) });
  const b = parsed.data;

  const form = {
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    source: b.source,
    propertyId: b.propertyId || null,
    propertyTitle: b.propertyTitle || "",
    userType: b.userType || null,
    budget: b.budget || "",
    propertyType: b.propertyType || "",
    locality: b.locality || "",
    city: b.city || "",
    message: (b.message || "").trim(),
    loanInterest: b.loanInterest === true,
    customerContactConsent: b.customerContactConsent !== false,
  };

  const duplicate = await CustomerLead.findOne({
    customerEmail: form.customerEmail,
    propertyId: form.propertyId,
    createdAt: { $gte: new Date(Date.now() - DAY_MS) },
  }).lean();
  if (duplicate) return res.json({ success: true, message: "Lead already submitted recently" });

  const created = await CustomerLead.create({ ...form, leadStatus: "new", ip: req.ip || "", crmLead: null, createdAt: new Date() });
  const lead = created.toObject ? created.toObject() : created;

  const property = form.propertyId && isPropertyId(form.propertyId)
    ? await Property.findOne({ _id: propertyIdMatch(form.propertyId) }).lean()
    : null;
  const crm = await onFormLead({ form, property, customerLeadId: lead._id });
  if (crm) await CustomerLead.updateOne({ _id: lead._id }, { $set: { crmLead: crm._id } });

  const { ip, crmLead, ...data } = lead;
  res.status(201).json({ success: true, data: { ...data, _id: String(data._id) } });
};

module.exports = { createCustomerLead, leadSchema };
