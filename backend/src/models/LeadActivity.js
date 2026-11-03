const mongoose = require('mongoose');

// Staff-written entries; the rest are written by the server and can't be edited.
const MANUAL_TYPES = ['note', 'call', 'whatsapp', 'email', 'sms', 'site_visit', 'meeting'];
const TYPES = [...MANUAL_TYPES, 'status_change', 'assignment', 'enquiry', 'view', 'system'];
const OUTCOMES = ['connected', 'no_answer', 'busy', 'wrong_number', ''];

const leadActivitySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: TYPES, required: true },
  body: { type: String, default: '', maxlength: 2000 },
  outcome: { type: String, enum: OUTCOMES, default: '' },
  scheduledAt: { type: Date, default: null, index: true },
  completedAt: { type: Date, default: null },
  durationSeconds: { type: Number },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

leadActivitySchema.index({ lead: 1, createdAt: -1 });

const LeadActivity = mongoose.models.LeadActivity || mongoose.model('LeadActivity', leadActivitySchema, 'crm_lead_activities');
LeadActivity.TYPES = TYPES;
LeadActivity.MANUAL_TYPES = MANUAL_TYPES;
LeadActivity.OUTCOMES = OUTCOMES;
module.exports = LeadActivity;
