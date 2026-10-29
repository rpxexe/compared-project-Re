const mongoose = require('mongoose');
const env = require('../config/env');

// Deliberately schema-less: the existing collection holds records imported from several
// sources with different field names. We only READ them and never reshape existing documents.
const propertySchema = new mongoose.Schema({}, { strict: false, collection: env.mongoCollection });
module.exports = mongoose.models.Property || mongoose.model('Property', propertySchema);
