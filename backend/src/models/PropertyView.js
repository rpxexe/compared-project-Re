const mongoose = require('mongoose');

// One row per (user, property): how often a signed-in user opened a listing, with a snapshot of
// their contact details so admins can follow up on it as a lead.
const propertyViewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  phone: { type: String, default: '' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  purpose: { type: String, default: '' },
  // The listing's _id as stored: an ObjectId or (for imported listings) a hex string.
  property: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  propertyTitle: { type: String, default: '' },
  propertyLocation: { type: String, default: '' },
  views: { type: Number, default: 0 },
  firstViewedAt: { type: Date },
  lastViewedAt: { type: Date, index: true },
  source: { type: String, default: 'mobile-app' },
  // "Clear viewed properties" hides rows from the user's own list; admins still see the lead.
  hiddenByUser: { type: Boolean, default: false },
}, { timestamps: true });

propertyViewSchema.index({ user: 1, property: 1 }, { unique: true });

module.exports = mongoose.models.PropertyView || mongoose.model('PropertyView', propertyViewSchema, 'property_views');
