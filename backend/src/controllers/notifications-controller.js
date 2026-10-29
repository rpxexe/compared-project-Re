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

exports.create = async (req, res) => {
  const body = req.body || {};
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(400, "A valid userId is required");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const type = body.type === undefined ? "info" : body.type;

  if (!title || title.length > 120) {
    throw new AppError(
      400,
      "title is required and must be 120 characters or fewer",
    );
  }
  if (!message || message.length > 1000) {
    throw new AppError(
      400,
      "message is required and must be 1000 characters or fewer",
    );
  }
  if (!["property", "price", "saved", "info"].includes(type)) {
    throw new AppError(400, "type must be property, price, saved, or info");
  }
  if (
    body.data !== undefined &&
    (body.data === null ||
      typeof body.data !== "object" ||
      Array.isArray(body.data))
  ) {
    throw new AppError(400, "data must be a JSON object");
  }

  const item = await Notification.create({
    user: userId,
    type,
    title,
    message,
    data: body.data || {},
  });

  res.status(201).json({ item: serialize(item) });
};

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
