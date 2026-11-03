const mongoose = require('mongoose');

const STATUSES = ['new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'won', 'lost'];
// `form` = a contact form submitted through POST /api/v2/leads/customer.
const SOURCES = ['enquiry', 'view', 'saved', 'manual', 'call', 'walk_in', 'website', 'form'];
const PRIORITIES = ['hot', 'warm', 'cold'];

// One CRM lead per (customer, listing), fed automatically by enquiries, views and saves, or
// created by staff. `user` and `property` are left unset (never null) when unknown, so the
// partial unique index only covers leads that have both.
const leadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '', trim: true, maxlength: 80 },
  phone: { type: String, default: '', index: true },
  email: { type: String, default: '', trim: true, maxlength: 254 },
  city: { type: String, default: '', trim: true, maxlength: 80 },
  purpose: { type: String, default: '' },
  // The listing's _id as stored: an ObjectId or (for imported listings) a hex string.
  property: { type: mongoose.Schema.Types.Mixed },
  propertyTitle: { type: String, default: '' },
  propertyLocation: { type: String, default: '' },
  propertyPrice: { type: String, default: '' },
  sources: [{ type: String, enum: SOURCES }],
  primarySource: { type: String, enum: SOURCES },
  enquiryIds: [{ type: mongoose.Schema.Types.ObjectId }],
  viewCount: { type: Number, default: 0 },
  lastActivityAt: { type: Date, index: -1 },
  status: { type: String, enum: STATUSES, default: 'new' },
  lostReason: { type: String, default: '' },
  priority: { type: String, enum: PRIORITIES, default: 'warm' },
  score: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
  assignedAt: { type: Date },
  nextFollowUpAt: { type: Date, default: null, index: true },
  // The follow-up time a reminder was last sent for, so each follow-up notifies once.
  followUpNotifiedFor: { type: Date, default: null },
  firstResponseAt: { type: Date },
  budgetMin: { type: Number },
  budgetMax: { type: Number },
  tags: [{ type: String, trim: true, maxlength: 30 }],
  createdBy: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

leadSchema.index(
  { user: 1, property: 1 },
  { unique: true, partialFilterExpression: { user: { $exists: true }, property: { $exists: true } } },
);
leadSchema.index({ status: 1, assignedTo: 1 });

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema, 'crm_leads');
Lead.STATUSES = STATUSES;
Lead.SOURCES = SOURCES;
Lead.PRIORITIES = PRIORITIES;
module.exports = Lead;
