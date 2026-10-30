// Normalised copies of the filterable fields, stored on each listing as `filterFields`.
// The source documents keep their original fields untouched (other systems read them); this
// sub-document only exists so filters are exact, unit-aware and index-friendly.
// Bump VERSION whenever compute() changes so the sync job rewrites every listing.
const { numericValue, firstString } = require('./property');

const VERSION = 2;
const FIELD = 'filterFields';

const AREA_TO_SQFT = { sqft: 1, sqm: 10.7639, sqyd: 9, acre: 43560 };
function areaUnit(raw) {
  const u = String(raw || 'sqft').toLowerCase().replace(/[\s.]/g, '');
  if (/^(sqm|sqmt|sqmeter|sqmetre|m2)/.test(u)) return 'sqm';
  if (/^(sqyd|sqyard|sqyds|gaj)/.test(u)) return 'sqyd';
  if (/^acre/.test(u)) return 'acre';
  return 'sqft';
}
const toSqft = (value, unit) => (value > 0 ? Math.round(value * AREA_TO_SQFT[areaUnit(unit)]) : null);

// Canonical property types. Order matters: the first pattern that matches wins.
const TYPES = [
  ['pg', /\bpg\b|paying\s*guest|co-?living|hostel/i, 'residential'],
  ['commercial_land', /commercial\s*(land|plot)|industrial\s*(land|plot)/i, 'commercial'],
  ['plot', /plot|\bland\b/i, 'land'],
  ['penthouse', /penthouse/i, 'residential'],
  ['builder_floor', /builder\s*floor/i, 'residential'],
  ['warehouse', /warehouse|godown|industrial/i, 'commercial'],
  ['apartment', /flat|apartment|studio/i, 'residential'],
  ['villa', /villa/i, 'residential'],
  ['independent_house', /\bhouse|bungalow/i, 'residential'],
  ['coworking', /co-?working/i, 'commercial'],
  ['office', /office/i, 'commercial'],
  ['shop', /shop|showroom|retail/i, 'commercial'],
];
function typeOf(p) {
  const raw = firstString(p.propertyType, p.type, p.propertyGroup);
  const hit = TYPES.find(([, re]) => re.test(raw));
  const commercialGroup = /comm?er/i.test(firstString(p.propertyGroup, p.category));
  // Land filed under the Commercial group is commercial land, not a residential plot.
  if (hit && hit[0] === 'plot' && commercialGroup) return { type: 'commercial_land', segment: 'commercial' };
  if (hit) return { type: hit[0], segment: hit[2] };
  return { type: raw ? 'other' : null, segment: commercialGroup || /comm?er/i.test(raw) ? 'commercial' : 'residential' };
}

const POSSESSION = [
  ['ready', /ready|completed|immediate|possession\s*soon/i],
  ['under_construction', /under\s*construction|ongoing/i],
  ['new_launch', /new\s*launch|pre[-\s]?launch|just\s*launched/i],
  ['upcoming', /upcoming|coming\s*soon/i],
];
// Accepts stored values and the app's labels alike ("Ready To Move", "ready", "Under Construction").
function possessionKey(raw) {
  const s = String(raw || '').replace(/_/g, ' ');
  return (POSSESSION.find(([, re]) => re.test(s)) || [null])[0];
}

// When a rental can be moved into. App posts store one of RENT_AVAILABILITY ("Immediately",
// "Within 15 days", ...); scraped rentals say "Ready To Move". "After" is checked before the
// month pattern because "After 1 month" contains it.
const AVAILABILITY = [
  ['later', /after/i],
  ['immediate', /immediate|ready|vacant/i],
  ['15d', /15\s*days?|two\s*weeks/i],
  ['1m', /1\s*month|30\s*days?|one\s*month/i],
];
function availableByKey(raw) {
  const s = String(raw || '');
  return (AVAILABILITY.find(([, re]) => re.test(s)) || [null])[0];
}

function furnishingKey(raw) {
  const s = String(raw || '').toLowerCase();
  if (/semi/.test(s)) return 'semi';
  if (/un-?\s*furnish|not\s*furnish/.test(s)) return 'unfurnished';
  if (/furnish/.test(s)) return 'furnished';
  return null;
}

function ageKey(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return null;
  if (/new|under/.test(s)) return 'new';
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (/\+/.test(s) || n >= 10) return '10+';
  if (n >= 5) return '5-10';
  if (n >= 1) return '1-5';
  return '0-1';
}

// "15th Floor", "6th of 20 Floors", "Ground Floor", 9 -> number. Bands like "High Floor" stay null.
function floorNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw || '').toLowerCase();
  if (/^\s*(ground|g\b)/.test(s)) return 0;
  const m = s.match(/^\s*(\d{1,3})(st|nd|rd|th)?\b/);
  return m ? Number(m[1]) : null;
}

const FACINGS = ['north-east', 'north-west', 'south-east', 'south-west', 'north', 'south', 'east', 'west'];
function facingKey(raw) {
  const s = String(raw || '').toLowerCase().replace(/[\s_]+/g, '-');
  return FACINGS.find((f) => s === f || s.startsWith(f)) || null;
}

// Imported amenity names vary ("Lift", "Lifts", "High Speed Elevators"); map them to stable keys.
const AMENITIES = [
  ['gym', /gym/i],
  ['pool', /swimming|\bpool\b/i],
  ['play_area', /play\s*area|kids|children/i],
  ['power_backup', /power\s*back|generator|dg\s*back/i],
  ['clubhouse', /club\s*house/i],
  ['security', /security|cctv|guard/i],
  ['lift', /\blifts?\b|elevator/i],
  ['parking', /parking|car\s*park/i],
  ['garden', /garden|landscap|^park$/i],
  ['jogging_track', /jogging|running\s*track/i],
  ['gated', /gated/i],
  ['intercom', /intercom|video\s*door/i],
  ['sports', /court|indoor\s*games|sports/i],
  ['air_conditioning', /air\s*condition|\bac\b|hvac/i],
  ['internet', /internet|wi-?fi|broadband/i],
  ['fire_safety', /fire/i],
  ['cafeteria', /cafeteria|caf[eé]|coffee|food\s*court/i],
  ['conference_room', /conference|meeting\s*room|board\s*room/i],
];
function amenityKeys(...lists) {
  const names = lists.flatMap((l) => (Array.isArray(l) ? l : typeof l === 'string' ? l.split(',') : []))
    .map((v) => (typeof v === 'string' ? v : firstString(v?.name, v?.label)))
    .filter(Boolean);
  return AMENITIES.filter(([, re]) => names.some((n) => re.test(n))).map(([k]) => k);
}

const hasUrl = (v) => {
  if (!v) return false;
  if (typeof v === 'string') return /^(https?:)?\/\//i.test(v.trim());
  if (Array.isArray(v)) return v.some(hasUrl);
  if (typeof v === 'object') return hasUrl(v.url || v.secure_url || v.src || v.path);
  return false;
};

function hasRera(p) {
  if (p.reraApproved === false) return false;
  const n = firstString(p.reraNumber, p.reraNo);
  return p.reraApproved === true || (!!n && !/^(na|n\/a|nil|none|not.*|-+|0+)$/i.test(n));
}

function postedBy(p) {
  if (p.dataSource === 'manual') {
    if (p.ownerRole === 'broker') return 'agent';
    if (p.ownerRole === 'developer') return 'builder';
    if (p.ownerRole === 'user') return 'owner';
    return null;
  }
  return firstString(p.developerName, p.builderName) ? 'builder' : null;
}

// Many imported createdAt values are spreadsheet debris ("59:33.2"); fall back to the
// timestamp inside the id (ObjectIds, and the hex ids the importer produced) when plausible.
const MIN_DATE = Date.UTC(2015, 0, 1);
function postedAt(p) {
  for (const v of [p.createdAt, p.postedAt, p.updatedAt]) {
    const d = v instanceof Date ? v : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v) : null;
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  const hex = String(p._id || '').slice(0, 8);
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    const ms = parseInt(hex, 16) * 1000;
    if (ms > MIN_DATE && ms < Date.now() + 86400000) return new Date(ms);
  }
  return null;
}

const intOrNull = (v) => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};
const lower = (v) => firstString(v).toLowerCase() || null;

function compute(doc) {
  const p = doc || {};
  const loc = p.location && typeof p.location === 'object' ? p.location : {};
  const area = p.area && typeof p.area === 'object' ? p.area : { value: p.area ?? p.superBuiltUpArea ?? p.builtUpArea };
  const price = numericValue(p.price?.max ?? p.price ?? p.amount ?? p.maxPrice);
  const bhkRaw = Array.isArray(p.bhk) ? p.bhk[0] : p.bhk ?? p.bedrooms ?? p.bedroom;
  const deal = /rent|lease/i.test(firstString(p.listingType)) ? 'rent' : 'sale';
  return {
    v: VERSION,
    deal,
    ...typeOf(p),
    city: lower(p.city) || lower(loc.city),
    price: price > 0 ? price : null,
    bhk: intOrNull(numericValue(bhkRaw)),
    bathrooms: intOrNull(p.bathrooms ?? p.bathroom),
    areaSqft: toSqft(numericValue(area.value ?? area), area.unit),
    furnishing: furnishingKey(p.furnishing),
    possession: possessionKey(firstString(p.possessionStatus, p.possession, p.availability)) || possessionKey(p.status),
    availableBy: deal === 'rent' ? availableByKey(firstString(p.availability, p.possessionStatus, p.possession)) : null,
    postedBy: postedBy(p),
    age: ageKey(p.ageOfProperty),
    floor: floorNumber(p.floor),
    facing: facingKey(p.facing),
    amenities: amenityKeys(p.amenities, p.facilities),
    photos: hasUrl(p.coverImage) || hasUrl(p.galleryImages) || hasUrl(p.images) || hasUrl(p.image),
    rera: hasRera(p),
    verified: p.verified === true,
    postedAt: postedAt(p),
  };
}

const withFilterFields = (doc) => ({ ...doc, [FIELD]: compute(doc) });

// Stored value comparison that treats Dates by value, so the sync job only writes real changes.
function sameFields(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  VERSION, FIELD, AMENITY_KEYS: AMENITIES.map(([k]) => k), TYPE_KEYS: TYPES.map(([k]) => k).concat('other'),
  FACINGS, AVAILABILITY_KEYS: AVAILABILITY.map(([k]) => k),
  compute, withFilterFields, sameFields, possessionKey, furnishingKey, availableByKey, areaUnit, toSqft, AREA_TO_SQFT,
};
