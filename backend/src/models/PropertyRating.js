const mongoose = require('mongoose');

// Denormalised rating summary in its own collection, so the existing
// `properties` documents are never modified by the rating feature.
const ratingSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  average: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
  distribution: { type: Map, of: Number, default: {} },
}, { timestamps: true });
ratingSchema.index({ average: -1, count: -1 });

module.exports = mongoose.models.PropertyRating || mongoose.model('PropertyRating', ratingSchema, 'property_ratings');
