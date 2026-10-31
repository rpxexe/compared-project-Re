const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  phone: { type: String, required: true },
  name: { type: String, default: '' },
  // The listing's _id as stored: an ObjectId or (for imported listings) a hex string.
  property: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  propertyTitle: { type: String, default: '' },
  message: { type: String, default: '', maxlength: 1000 },
  source: { type: String, default: 'mobile-app' },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
}, { timestamps: true });

module.exports = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
