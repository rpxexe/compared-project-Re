const { escapeRegex, str } = require('./validate');
const { FIELD, AMENITY_KEYS, TYPE_KEYS, FACINGS, AVAILABILITY_KEYS, possessionKey, furnishingKey, toSqft } = require('./filterFields');

const STATUS_FIELDS = ['possessionStatus', 'possession', 'status'];
const TYPE_FIELDS = ['propertyType', 'propertyGroup', 'type'];
const SEARCH_FIELDS = ['title', 'name', 'projectName', 'city', 'locality', 'address', 'developerName', 'builderName', 'propertyType', 'propertyGroup'];
const TITLE_FIELDS = ['title', 'name', 'projectName'];

const anyField = (fields, re) => ({ $or: fields.map((f) => ({ [f]: re })) });
const re = (text) => new RegExp(escapeRegex(text), 'i');
const ff = (key) => `${FIELD}.${key}`;

// Project categories for the "New Project" tab, matched against real status fields.
const SECTIONS = {
  'new-launch': anyField(STATUS_FIELDS, /new\s*launch|pre[-\s]?launch|just\s*launched/i),
  upcoming: anyField(STATUS_FIELDS, /upcoming|coming\s*soon/i),
  'under-construction': anyField(STATUS_FIELDS, /under\s*construction|ongoing/i),
  ready: anyField(STATUS_FIELDS, /ready|completed|immediate/i),
};
SECTIONS.projects = { $or: [...Object.values(SECTIONS), { propertyGroup: /project/i }] };

// Hide submissions that are waiting for / failed moderation. App posts use approvalStatus; the
// shared collection's own moderation (website/scraper) uses status. Documents with neither stay visible.
const PUBLIC = {
  approvalStatus: { $nin: ['pending', 'rejected'] },
  status: { $nin: ['pending', 'rejected'] },
};

// Search contexts the app offers. Each is a fixed slice of the listings; `deal` can be overridden
// (commercial covers both buying and leasing).
const CONTEXTS = {
  buy_residential: { deal: 'sale', segment: 'residential' },
  rent_residential: { deal: 'rent', segment: 'residential' },
  new_projects: { deal: 'sale', segment: 'residential', possession: ['new_launch', 'under_construction', 'upcoming'] },
  commercial: { deal: 'sale', segment: 'commercial' },
  plots: { deal: 'sale', segment: 'land' },
};

const FURNISHING = ['furnished', 'semi', 'unfurnished'];
const POSSESSION = ['ready', 'under_construction', 'new_launch', 'upcoming'];
const POSTED_BY = ['owner', 'agent', 'builder'];
const AGES = ['new', '0-1', '1-5', '5-10', '10+'];
const AREA_UNITS = ['sqft', 'sqm', 'sqyd', 'acre'];
const FLOORS = { ground: [0, 0], '1-5': [1, 5], '6-10': [6, 10], '11-20': [11, 20], '20+': [21, Infinity] };
const POSTED_SINCE = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '180d': 180 };

// Comma-separated (or repeated) query values, trimmed, de-duplicated and limited to `allowed`.
function list(raw, allowed, map = (v) => v) {
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((v) => (typeof v === 'string' ? v.split(',') : []));
  const out = parts.map((v) => map(v.trim().slice(0, 40))).filter((v) => v && (!allowed || allowed.includes(v)));
  return [...new Set(out)].slice(0, 25);
}
const num = (raw, max = 14) => {
  const n = Number(str(raw, max));
  return Number.isFinite(n) && n > 0 ? n : null;
};
// Like num() but 0 is meaningful (ground floor).
const whole = (raw) => {
  const s = str(raw, 4);
  return /^\d{1,3}$/.test(s) ? Number(s) : null;
};

// "1,2,5+" -> exact counts plus an open upper bound. Also accepts the legacy single value "4+",
// and "4 " - what an unencoded "+" in a shared link decodes to.
function countCondition(field, raw) {
  const plus = (Array.isArray(raw) ? raw : [raw]).map((v) => (typeof v === 'string' ? v.replace(/(\d) +(?=,|$)/g, '$1+') : v));
  const vals = list(plus, null, (v) => (/^\d{1,2}\+?$/.test(v) ? v : ''));
  if (!vals.length) return null;
  const exact = vals.filter((v) => !v.endsWith('+')).map(Number);
  const open = vals.filter((v) => v.endsWith('+')).map((v) => parseInt(v, 10));
  const or = [];
  if (exact.length) or.push({ [field]: { $in: exact } });
  if (open.length) or.push({ [field]: { $gte: Math.min(...open) } });
  return or.length === 1 ? or[0] : { $or: or };
}

function range(field, min, max) {
  const c = {};
  if (min != null) c.$gte = min;
  if (max != null) c.$lte = max;
  return Object.keys(c).length ? { [field]: c } : null;
}

function buildPropertyFilter(q = {}, { includeHidden = false, now = Date.now() } = {}) {
  const and = [];
  const push = (c) => { if (c) and.push(c); };
  if (!includeHidden) and.push(PUBLIC);

  const search = str(q.search, 80);
  if (search) and.push(anyField(SEARCH_FIELDS, re(search)));
  const city = str(q.city, 60);
  if (city) and.push({ city: re(city) });
  const locality = str(q.locality, 60);
  if (locality) and.push({ locality: re(locality) });
  const dev = str(q.developer, 60);
  if (dev) and.push(anyField(['developerName', 'builderName'], re(dev)));
  // Project name only (the general search also matches city, developer, type...).
  const project = str(q.project, 80);
  if (project) and.push(anyField(TITLE_FIELDS, re(project)));

  // Search context -> deal / segment slice.
  const ctx = CONTEXTS[str(q.context, 30)];
  const deal = ['sale', 'rent'].includes(str(q.deal, 6)) ? str(q.deal, 6) : ctx?.deal;
  if (deal) and.push({ [ff('deal')]: deal });
  if (ctx) and.push({ [ff('segment')]: ctx.segment });
  if (ctx?.possession) and.push({ [ff('possession')]: { $in: ctx.possession } });

  // Free-text type (Home shortcuts, older links) vs canonical keys from the filter screen.
  const type = str(q.propertyType, 60);
  if (type) and.push(anyField(TYPE_FIELDS, re(type)));
  const types = list(q.propertyTypes, TYPE_KEYS);
  if (types.length) and.push({ [ff('type')]: { $in: types } });

  push(countCondition(ff('bhk'), q.bhk));
  push(countCondition(ff('bathrooms'), q.bathrooms));
  push(range(ff('price'), num(q.minPrice), num(q.maxPrice)));

  const unit = AREA_UNITS.includes(str(q.areaUnit, 6)) ? str(q.areaUnit, 6) : 'sqft';
  push(range(ff('areaSqft'), toSqft(num(q.minArea, 10), unit), toSqft(num(q.maxArea, 10), unit)));

  const furnishing = list(q.furnishing, FURNISHING, (v) => (FURNISHING.includes(v) ? v : furnishingKey(v)));
  if (furnishing.length) and.push({ [ff('furnishing')]: { $in: furnishing } });

  // Accepts keys ("under_construction") and the labels older screens send ("Under Construction").
  const possessionRaw = list(q.possession, null);
  const possession = possessionRaw.map((v) => (POSSESSION.includes(v) ? v : possessionKey(v))).filter(Boolean);
  if (possession.length) and.push({ [ff('possession')]: { $in: [...new Set(possession)] } });
  else if (possessionRaw.length) and.push(anyField(STATUS_FIELDS, re(possessionRaw[0])));

  const availableBy = list(q.availableBy, AVAILABILITY_KEYS);
  if (availableBy.length) and.push({ [ff('availableBy')]: { $in: availableBy } });

  const postedBy = list(q.postedBy, POSTED_BY);
  if (postedBy.length) and.push({ [ff('postedBy')]: { $in: postedBy } });
  const ages = list(q.age, AGES);
  if (ages.length) and.push({ [ff('age')]: { $in: ages } });
  const facing = list(q.facing, FACINGS);
  if (facing.length) and.push({ [ff('facing')]: { $in: facing } });
  const amenities = list(q.amenities, AMENITY_KEYS);
  if (amenities.length) and.push({ [ff('amenities')]: { $all: amenities } });

  push(range(ff('floor'), whole(q.minFloor), whole(q.maxFloor)));
  const floors = list(q.floor, Object.keys(FLOORS));
  if (floors.length) {
    const ors = floors.map((f) => range(ff('floor'), FLOORS[f][0], Number.isFinite(FLOORS[f][1]) ? FLOORS[f][1] : null));
    and.push(ors.length === 1 ? ors[0] : { $or: ors });
  }

  if (String(q.verified) === 'true') and.push({ [ff('verified')]: true });
  if (String(q.withPhotos) === 'true') and.push({ [ff('photos')]: true });
  if (String(q.rera) === 'true') and.push({ [ff('rera')]: true });

  const since = POSTED_SINCE[str(q.postedSince, 5)];
  if (since) and.push({ [ff('postedAt')]: { $gte: new Date(now - since * 86400000) } });

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
    case 'price_asc': return { [ff('price')]: 1, _id: -1 };
    case 'price_desc': return { [ff('price')]: -1, _id: -1 };
    case 'newest': return { [ff('postedAt')]: -1, _id: -1 };
    case 'relevance': return { featured: -1, [ff('postedAt')]: -1, _id: -1 };
    default: return { createdAt: -1, _id: -1 };
  }
}

// Relevance with a search term ranks title matches first; returns the extra condition that
// splits the result set into [title matches, everything else].
function titleMatch(q) {
  const search = str(q.search, 80);
  return search ? anyField(TITLE_FIELDS, re(search)) : null;
}

module.exports = { buildPropertyFilter, buildSort, titleMatch, SECTIONS, PUBLIC, CONTEXTS };
