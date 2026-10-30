const mongoose = require('mongoose');
const env = require('../config/env');

// Deliberately schema-less: the existing collection holds records imported from several
// sources with different field names. We only READ them and never reshape existing documents.
// strictQuery must be off here: db.js enables it globally, and with no declared paths Mongoose
// would silently drop EVERY filter (city, locality, approvalStatus...), returning all listings
// - including pending/rejected ones - for any query.
const propertySchema = new mongoose.Schema({}, { strict: false, strictQuery: false, collection: env.mongoCollection });
module.exports = mongoose.models.Property || mongoose.model('Property', propertySchema);
