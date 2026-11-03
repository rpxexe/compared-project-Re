const mongoose = require('mongoose');

const SOURCES = ['home_page_contact', 'property_page_contact', 'smart_properties_page_form', 'quick_links_property_page_form'];

// Contact-form submissions from POST /api/v2/leads/customer, stored as submitted. Each one also
// feeds a CRM lead (crmLead), which is where staff follow it up.
const customerLeadSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 100 },
  customerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  customerPhone: { type: String, required: true },
  source: { type: String, enum: SOURCES, required: true },
  propertyId: { type: String, default: null },
  propertyTitle: { type: String, default: '' },
  userType: { type: String, enum: ['buyer', 'investor', null], default: null },
  budget: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  locality: { type: String, default: '' },
  city: { type: String, default: '' },
  message: { type: String, default: '', maxlength: 1000 },
  loanInterest: { type: Boolean, default: false },
  customerContactConsent: { type: Boolean, default: true },
  leadStatus: { type: String, enum: ['new', 'contacted', 'qualified', 'closed'], default: 'new' },
  ip: { type: String, default: '' },
  crmLead: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

// Duplicate check: same email + property within 24 hours.
customerLeadSchema.index({ customerEmail: 1, propertyId: 1, createdAt: -1 });

const CustomerLead = mongoose.models.CustomerLead || mongoose.model('CustomerLead', customerLeadSchema, 'customer_leads');
CustomerLead.SOURCES = SOURCES;
module.exports = CustomerLead;
