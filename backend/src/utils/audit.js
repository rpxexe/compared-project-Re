const env = require("../config/env");
const { AuditLog } = require("../models");

// Records a CRM write. Never fails the request it belongs to.
async function audit(req, action, entity, entityId, changes = {}) {
  try {
    await AuditLog.create({
      actor: req.user.id,
      actorRole: req.user.role,
      action,
      entity,
      entityId: String(entityId ?? ""),
      changes,
      ip: req.ip || "",
      createdAt: new Date(),
    });
  } catch (e) {
    if (!env.isTest) console.error("audit log write failed:", e.message);
  }
}

// { field: [before, after] } for the keys of `after` whose value changed.
function diff(before = {}, after = {}) {
  const out = {};
  for (const [k, v] of Object.entries(after)) {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(v ?? null)) out[k] = [before[k] ?? null, v ?? null];
  }
  return out;
}

module.exports = { audit, diff };
