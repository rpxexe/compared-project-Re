const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // The listing's _id as stored: an ObjectId or (for imported listings) a hex string.
  property: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  userName: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });
reviewSchema.index({ property: 1, user: 1 }, { unique: true });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);
