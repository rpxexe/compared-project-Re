const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "AppUser", required: true, index: true },
  type: { type: String, enum: ["property", "price", "saved", "info"], default: "info" },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  readAt: { type: Date, default: null },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
