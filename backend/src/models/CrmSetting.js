const mongoose = require('mongoose');

// A single document (key "global") holding settings staff can change without a redeploy.
// Missing values fall back to the defaults in utils/crmSettings.js.
const crmSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.models.CrmSetting || mongoose.model('CrmSetting', crmSettingSchema, 'crm_settings');
