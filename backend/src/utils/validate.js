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

module.exports = { isObjectId, cleanPhone, isValidPhone, str, escapeRegex, paging, requireObjectId };
