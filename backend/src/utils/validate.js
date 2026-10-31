const mongoose = require('mongoose');
const { bad } = require('./errors');

const OBJECT_ID = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID.test(v);

function cleanPhone(phone) {
  return String(phone ?? '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
}
// Indian mobile numbers start with 6-9.
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(p);

function str(v, max = 200) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim().slice(0, max);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paging(query, { defLimit = 12, maxLimit = 30 } = {}) {
  const page = Math.max(1, parseInt(str(query.page, 6), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(str(query.limit, 4), 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function requireObjectId(id, label = 'id') {
  if (!isObjectId(id)) throw bad(`Invalid ${label}`);
  return id;
}

// Listing ids come in two formats: app-created listings get standard 24-char ObjectIds, while
// most imported listings carry their source's 25-27 char hex string as the _id.
const PROPERTY_ID = /^[a-f\d]{20,32}$/i;
const isPropertyId = (v) => typeof v === 'string' && PROPERTY_ID.test(v);

function requirePropertyId(id) {
  if (!isPropertyId(id)) throw bad('Invalid property id');
  return id;
}

// The values a listing id may be stored as: a 24-char id could be either an ObjectId or a string.
const propertyIdValues = (id) => (isObjectId(id) ? [new mongoose.Types.ObjectId(id), id] : [id]);
// Filter value matching a listing _id - or a stored reference to one - whichever type it has.
const propertyIdMatch = (id) => ({ $in: propertyIdValues(id) });

module.exports = {
  isObjectId, cleanPhone, isValidPhone, str, escapeRegex, paging, requireObjectId,
  isPropertyId, requirePropertyId, propertyIdValues, propertyIdMatch,
};
