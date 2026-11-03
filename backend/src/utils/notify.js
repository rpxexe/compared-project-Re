const env = require("../config/env");
const { Notification } = require("../models");

// In-app notifications for one or more accounts. Best effort: a failure is logged, not thrown.
async function notify(userIds, { type = "info", title, message, data = {} }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  for (const user of ids) {
    try {
      await Notification.create({
        user, type, title: title.slice(0, 120), message: message.slice(0, 1000), data, readAt: null, createdAt: new Date(),
      });
    } catch (e) {
      if (!env.isTest) console.error("notification failed:", e.message);
    }
  }
}

module.exports = { notify };
