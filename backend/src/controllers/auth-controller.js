const env = require("../config/env");
const { findAccountById } = require("../middleware/auth");
const { AppError } = require("../utils/errors");
const { revokeTokens } = require("../utils/firebase");

// Phone sign-in is done by Firebase Authentication in the app; the app then exchanges the Firebase
// ID token for a session at POST /api/v2/customers/register. The backend sends no SMS itself.

// POST /auth/logout-all: bumps the account's token version, so every JWT issued so far (on this
// and every other device) stops working, and revokes the linked Firebase session if there is one.
const logoutAll = async (req, res) => {
  const found = await findAccountById(req.user.id);
  if (!found) throw new AppError(401, "Account not available. Please log in again.");
  await found.Model.updateOne({ _id: found.user._id }, { $inc: { tokenVersion: 1 } });
  if (found.user.firebaseUid) {
    try {
      await revokeTokens(found.user.firebaseUid);
    } catch (e) {
      if (!env.isTest) console.error(`Firebase token revocation failed: ${e?.code || "unknown error"}`);
    }
  }
  res.json({ ok: true, message: "Signed out on all devices" });
};

exports.logoutAll = logoutAll;
