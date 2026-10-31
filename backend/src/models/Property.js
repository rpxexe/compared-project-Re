const mongoose = require('mongoose');
const env = require('../config/env');

// Deliberately schema-less: the existing collection holds records imported from several
// sources with different field names. We only READ them and never reshape existing documents.
// strictQuery must be off here: db.js enables it globally, and with no declared paths Mongoose
// would silently drop EVERY filter (city, locality, approvalStatus...), returning all listings
// - including pending/rejected ones - for any query.
// _id is Mixed because most imported listings use hex strings as ids; with the default ObjectId
// type every lookup by such an id fails to cast. New listings still get an ObjectId.
const propertySchema = new mongoose.Schema(
  { _id: { type: mongoose.Schema.Types.Mixed, default: () => new mongoose.Types.ObjectId() } },
  { strict: false, strictQuery: false, collection: env.mongoCollection },
);
module.exports = mongoose.models.Property || mongoose.model('Property', propertySchema);
