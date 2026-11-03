const mongoose = require("mongoose");
const { Notification } = require("../models");
const { AppError } = require("../utils/errors");

const serialize = (item) => ({
  id: String(item._id),
  type: item.type || "info",
  title: item.title,
  message: item.message,
  unread: !item.readAt,
  readAt: item.readAt || null,
  createdAt: item.createdAt,
  data: item.data || {},
});

exports.list = async (req, res) => {
  const items = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();
  res.json({
    items: items.map(serialize),
    unreadCount: items.filter((item) => !item.readAt).length,
  });
};

exports.markRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    throw new AppError(400, "Invalid notification id");
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
  if (!item) {
    const exists = await Notification.exists({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!exists) throw new AppError(404, "Notification not found");
    const alreadyRead = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).lean();
    return res.json({ item: serialize(alreadyRead) });
  }
  res.json({ item: serialize(item) });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany(
    { user: req.user.id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ ok: true });
};
