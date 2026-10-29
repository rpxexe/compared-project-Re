const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  phone: { type: String, required: true },
  name: { type: String, default: '' },
  property: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  propertyTitle: { type: String, default: '' },
  message: { type: String, default: '', maxlength: 1000 },
  source: { type: String, default: 'mobile-app' },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
}, { timestamps: true });

module.exports = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
