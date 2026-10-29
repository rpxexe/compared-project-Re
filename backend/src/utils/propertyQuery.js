const { escapeRegex, str } = require('./validate');

const STATUS_FIELDS = ['possessionStatus', 'possession', 'status'];
const TYPE_FIELDS = ['propertyType', 'propertyGroup', 'type'];
const SEARCH_FIELDS = ['title', 'name', 'projectName', 'city', 'locality', 'address', 'developerName', 'builderName', 'propertyType', 'propertyGroup'];
const PRICE_FIELDS = ['price', 'price.max', 'amount', 'maxPrice'];

const anyField = (fields, re) => ({ $or: fields.map((f) => ({ [f]: re })) });
const re = (text) => new RegExp(escapeRegex(text), 'i');

// Project categories for the "New Project" tab, matched against real status fields.
const SECTIONS = {
  'new-launch': anyField(STATUS_FIELDS, /new\s*launch|pre[-\s]?launch|just\s*launched/i),
  upcoming: anyField(STATUS_FIELDS, /upcoming|coming\s*soon/i),
  'under-construction': anyField(STATUS_FIELDS, /under\s*construction|ongoing/i),
  ready: anyField(STATUS_FIELDS, /ready|completed|immediate/i),
};
SECTIONS.projects = { $or: [...Object.values(SECTIONS), { propertyGroup: /project/i }] };

// Hide submissions that are waiting for / failed moderation. Existing documents have no
// approvalStatus field, so they stay visible.
const PUBLIC = { approvalStatus: { $nin: ['pending', 'rejected'] } };

function bhkCondition(raw) {
  const v = str(raw, 3);
  if (/^\d\+?$/.test(v)) {
    const n = parseInt(v, 10);
    if (v.endsWith('+')) {
      return { $or: [{ bhk: { $gte: n } }, { bedrooms: { $gte: n } }, { bhk: new RegExp(`(^|\\D)([${n}-9])(\\D|$)`) }, { bedrooms: new RegExp(`(^|\\D)([${n}-9])(\\D|$)`) }] };
    }
    const exact = new RegExp(`(^|\\D)${n}(\\D|$)`);
    return { $or: [{ bhk: n }, { bedrooms: n }, { bhk: exact }, { bedrooms: exact }] };
  }
  return null;
}

function buildPropertyFilter(q = {}, { includeHidden = false } = {}) {
  const and = [];
  if (!includeHidden) and.push(PUBLIC);

  const search = str(q.search, 80);
  if (search) and.push(anyField(SEARCH_FIELDS, re(search)));
  const city = str(q.city, 60);
  if (city) and.push({ city: re(city) });
  const locality = str(q.locality, 60);
  if (locality) and.push({ locality: re(locality) });
  const type = str(q.propertyType, 60);
  if (type) and.push(anyField(TYPE_FIELDS, re(type)));
  const bhk = bhkCondition(q.bhk);
  if (bhk) and.push(bhk);
  const dev = str(q.developer, 60);
  if (dev) and.push(anyField(['developerName', 'builderName'], re(dev)));
  const poss = str(q.possession, 60);
  if (poss) and.push(anyField(STATUS_FIELDS, re(poss)));

  const min = Number(str(q.minPrice, 14));
  const max = Number(str(q.maxPrice, 14));
  if (Number.isFinite(min) && min > 0) and.push({ $or: PRICE_FIELDS.map((f) => ({ [f]: { $gte: min } })) });
  if (Number.isFinite(max) && max > 0) and.push({ $or: PRICE_FIELDS.map((f) => ({ [f]: { $lte: max, $gt: 0 } })) });
  const minArea = Number(str(q.minArea, 10));
  const maxArea = Number(str(q.maxArea, 10));
  if (Number.isFinite(minArea) && minArea > 0) and.push({ $or: ['area', 'area.value', 'superBuiltUpArea', 'builtUpArea'].map((f) => ({ [f]: { $gte: minArea } })) });
  if (Number.isFinite(maxArea) && maxArea > 0) and.push({ $or: ['area', 'area.value', 'superBuiltUpArea', 'builtUpArea'].map((f) => ({ [f]: { $lte: maxArea, $gt: 0 } })) });

  const cond = str(q.condition, 10).toLowerCase();
  if (cond === 'resale') and.push(anyField([...TYPE_FIELDS, ...STATUS_FIELDS, 'listingType'], /resale/i));
  else if (cond === 'new') and.push(anyField([...TYPE_FIELDS, ...STATUS_FIELDS, 'listingType'], /\bnew\b|launch|under\s*construction|upcoming/i));

  if (String(q.featured) === 'true') and.push({ featured: true });

  const section = str(q.section, 30);
  if (SECTIONS[section]) and.push(SECTIONS[section]);

  if (includeHidden) {
    const a = str(q.approvalStatus, 12);
    if (['pending', 'approved', 'rejected'].includes(a)) and.push({ approvalStatus: a });
    const ds = str(q.dataSource, 20);
    if (ds) and.push({ dataSource: ds });
  }
  return and.length ? { $and: and } : {};
}

function buildSort(sort) {
  switch (str(sort, 12)) {
    case 'price_asc': return { price: 1, _id: -1 };
    case 'price_desc': return { price: -1, _id: -1 };
    default: return { createdAt: -1, _id: -1 };
  }
}

module.exports = { buildPropertyFilter, buildSort, SECTIONS, PUBLIC };
