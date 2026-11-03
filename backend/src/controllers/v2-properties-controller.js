// Public property endpoints of the mobile API contract (/api/v2/properties, see MOBILE_API.md).
// Response and error shapes follow the contract exactly, including its { success:false, message }
// errors and filters that silently ignore invalid values.
const { Property } = require("../models");
const { escapeRegex, str, isPropertyId, propertyIdMatch } = require("../utils/validate");
const { PUBLIC } = require("../utils/propertyQuery");
const { FIELD } = require("../utils/filterFields");
const { cached } = require("../utils/cache");
const Fuse = require("fuse.js");
const { toContractProperty, toCard } = require("../utils/contractProperty");

const ff = (k) => `${FIELD}.${k}`;
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const exact = (v) => new RegExp(`^${escapeRegex(v)}$`, "i");
const anyField = (fields, cond) => ({ $or: fields.map((f) => ({ [f]: cond })) });
const and = (conds) => (conds.length ? { $and: conds } : {});
const intIn = (v, def, min, max) => {
  const n = parseInt(str(v, 6), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const float = (v) => {
  const n = parseFloat(str(v, 20));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
// Repeated (?a=1&a=2) and, where allowed, comma-separated values.
function values(raw, { comma = false } = {}) {
  const parts = (Array.isArray(raw) ? raw : [raw]).filter((v) => typeof v === "string");
  const out = (comma ? parts.flatMap((v) => v.split(",")) : parts).map((v) => v.trim().slice(0, 100)).filter(Boolean);
  return [...new Set(out)].slice(0, 25);
}
// Free text: letters, digits and a little punctuation, 2-100 characters; anything else -> "".
function sanitize(raw) {
  const s = str(raw, 300).replace(/[^\p{L}\p{N}\s.,+\-/]/gu, " ").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 100 ? s : "";
}
const byNewest = { [ff("postedAt")]: -1, _id: -1 };

// Area units the contract accepts, in sq.ft.
const UNIT_SQFT = { sqft: 1, sqmts: 10.7639, sqm: 10.7639, sqyd: 9, guntas: 1089, hectares: 107639, acres: 43560, acre: 43560 };
const toSqftUnit = (v, unit) => (v == null ? null : Math.round(v * (UNIT_SQFT[unit] || 1)));

const FIELDS = {
  city: ["city", "location.city"],
  locality: ["locality", "location.locality"],
  propertyType: ["propertyType", "propertyGroup", "type"],
  furnishing: ["furnishing"],
  facing: ["facing"],
  parkings: ["parkings", "parking"],
  possessionStatus: ["possessionStatus", "possession", "status"],
  floorLabel: ["floorLabel", "floor"],
  amenities: ["amenities", "facilities", "security"],
};

function bhkCondition(raw) {
  const vals = values(raw, { comma: true }).filter((v) => /^\d{1,2}\+?$/.test(v));
  if (!vals.length) return null;
  const or = vals.map((v) => (v.endsWith("+") ? { [ff("bhk")]: { $gte: parseInt(v, 10) } } : { [ff("bhk")]: Number(v) }));
  return or.length === 1 ? or[0] : { $or: or };
}

function range(field, min, max) {
  const c = {};
  if (min != null) c.$gte = min;
  if (max != null) c.$lte = max;
  return Object.keys(c).length ? { [field]: c } : null;
}

function listingFilter(q) {
  const conds = [PUBLIC];
  const city = str(q.city, 60);
  if (city) conds.push(anyField(FIELDS.city, exact(city)));
  for (const key of ["locality", "propertyType", "furnishing", "facing", "parkings", "possessionStatus", "amenities"]) {
    const vals = values(q[key]);
    if (vals.length) conds.push(anyField(FIELDS[key], { $in: vals.map(exact) }));
  }
  const floors = values(q.floorLabel, { comma: true });
  if (floors.length) conds.push(anyField(FIELDS.floorLabel, { $in: floors.map(exact) }));
  const bhk = bhkCondition(q.bhk);
  if (bhk) conds.push(bhk);
  const unit = str(q.areaUnit, 10).toLowerCase();
  const area = range(ff("areaSqft"), toSqftUnit(float(q.areaMin), unit), toSqftUnit(float(q.areaMax), unit));
  if (area) conds.push(area);
  const price = range(ff("price"), float(q.priceMin), float(q.priceMax));
  if (price) conds.push(price);
  const search = sanitize(q.search);
  if (search) conds.push(anyField(["title", "name", "description", "locality"], new RegExp(escapeRegex(search), "i")));
  return and(conds);
}

const SORTS = {
  relevance: { featured: -1, ...byNewest },
  "price-low-high": { [ff("price")]: 1, _id: -1 },
  "price-high-low": { [ff("price")]: -1, _id: -1 },
  newest: byNewest,
  oldest: { [ff("postedAt")]: 1, _id: 1 },
};

// ----- Filter options -----------------------------------------------------------------------
const cleanList = (arr) =>
  [...new Set(arr.flat(Infinity).filter((v) => typeof v === "string" || typeof v === "number").map((v) => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const distinctOf = async (fields) => cleanList(await Promise.all(fields.map((f) => Property.distinct(f, PUBLIC))));

const AREA_UNITS = { sqft: 1, sqmts: 10.7639, guntas: 1089, hectares: 107639, acres: 43560 };

const loadFilters = cached(2 * 60 * 1000, async () => {
  const [cities, types, furnishing, facing, parking, possession, floors, amenities, smallest, largest] = await Promise.all([
    distinctOf(["city"]),
    distinctOf(["propertyType"]),
    distinctOf(["furnishing"]),
    distinctOf(["facing"]),
    distinctOf(["parkings", "parking"]),
    distinctOf(["possessionStatus"]),
    distinctOf(["floorLabel"]),
    distinctOf(["amenities"]),
    Property.find({ ...PUBLIC, [ff("areaSqft")]: { $gt: 0 } }).sort({ [ff("areaSqft")]: 1 }).limit(1).select(FIELD).lean(),
    Property.find({ ...PUBLIC, [ff("areaSqft")]: { $gt: 0 } }).sort({ [ff("areaSqft")]: -1 }).limit(1).select(FIELD).lean(),
  ]);
  const min = smallest[0]?.[FIELD]?.areaSqft || 0;
  const max = largest[0]?.[FIELD]?.areaSqft || 0;
  const areaBounds = Object.fromEntries(Object.entries(AREA_UNITS).map(([unit, sqft]) => [
    unit, { min: Math.floor(min / sqft), max: Math.ceil(max / sqft) },
  ]));
  return {
    cities,
    propertyTypeOptions: types,
    furnishingOptions: furnishing,
    facingOptions: facing,
    parkingOptions: parking,
    possessionStatusOptions: possession,
    floorLabelOptions: floors,
    amenitiesOptions: amenities,
    areaBounds,
  };
});

const getFilters = async (req, res) => {
  res.json(await loadFilters());
};

const loadLocalitiesByType = cached(5 * 60 * 1000, async () => {
  const [residential, commercial] = await Promise.all(["residential", "commercial"].map(async (segment) =>
    cleanList(await Property.distinct("locality", { ...PUBLIC, [ff("segment")]: segment }))));
  return { residential, commercial };
});

const getLocalitiesByType = async (req, res) => {
  res.json(await loadLocalitiesByType());
};

const getLocalitiesByCity = async (req, res) => {
  const city = typeof req.params.city === "string" ? req.params.city.trim() : "";
  if (city.length < 2) return fail(res, 400, "A valid city name is required.");
  const localities = cleanList(await Property.distinct("locality", and([PUBLIC, anyField(FIELDS.city, exact(city.slice(0, 60)))])));
  res.json({ localities });
};

// ----- Location autocomplete ----------------------------------------------------------------
// Every distinct (city, locality, pincode) among public listings, refreshed every 5 minutes.
const loadPlaces = cached(5 * 60 * 1000, async () => {
  const docs = await Property.find(PUBLIC).select("city locality pincode location address").limit(50000).lean();
  const cities = new Set();
  const localities = new Map();
  const pincodes = new Map();
  for (const d of docs) {
    const loc = d.location && typeof d.location === "object" ? d.location : {};
    const addr = d.address && typeof d.address === "object" ? d.address : {};
    const city = String(d.city || loc.city || addr.city || "").trim();
    const locality = String(d.locality || loc.locality || addr.locality || "").trim();
    const pincode = String(d.pincode || addr.pincode || "").trim();
    if (city) cities.add(city);
    if (locality) localities.set(`${locality}|${city}`.toLowerCase(), { city, locality, pincode: /^\d{6}$/.test(pincode) ? pincode : null });
    if (/^\d{6}$/.test(pincode)) pincodes.set(pincode, { city, locality, pincode });
  }
  return [
    ...[...cities].map((city) => ({ label: city, city, locality: null, pincode: null, type: "city" })),
    ...[...localities.values()].map((l) => ({ label: [l.locality, l.city].filter(Boolean).join(", "), ...l, type: "locality" })),
    ...[...pincodes.values()].map((p) => ({ label: [p.pincode, p.locality, p.city].filter(Boolean).join(", "), ...p, type: "pincode" })),
  ];
});

const getLocationOptions = async (req, res) => {
  const q = sanitize(req.query.q).toLowerCase();
  if (!q) return res.json([]);
  const city = str(req.query.city, 60).toLowerCase();
  const places = (await loadPlaces()).filter((p) => !city || (p.city || "").toLowerCase() === city);
  const starts = (p) => [p.city, p.locality, p.pincode].some((v) => v && v.toLowerCase().startsWith(q));
  const hits = places.filter((p) => p.label.toLowerCase().includes(q));
  hits.sort((a, b) => Number(starts(b)) - Number(starts(a)) || a.label.length - b.label.length);
  res.json(hits.slice(0, 8));
};

// ----- Lists --------------------------------------------------------------------------------
const cityCond = (q) => {
  const city = str(q.city, 60);
  return city ? [anyField(FIELDS.city, exact(city))] : [];
};

const getFeatured = async (req, res) => {
  const limit = intIn(req.query.limit, 3, 1, 20);
  const docs = await Property.find(and([PUBLIC, { featured: true }, ...cityCond(req.query)])).sort(byNewest).limit(limit).lean();
  res.json(docs.map((d) => toCard(d, "featured")));
};

const getRecent = async (req, res) => {
  const limit = intIn(req.query.limit, 6, 1, 20);
  const docs = await Property.find(and([PUBLIC, ...cityCond(req.query)])).sort(byNewest).limit(limit).lean();
  res.json(docs.map((d) => toCard(d, "recent")));
};

const getProperties = async (req, res) => {
  const page = intIn(req.query.page, 1, 1, 1000);
  const limit = intIn(req.query.limit, 12, 1, 100);
  const filter = listingFilter(req.query);
  const sort = SORTS[str(req.query.sortBy, 20)] || SORTS.relevance;
  const [docs, totalMatched] = await Promise.all([
    Property.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  res.json({
    properties: docs.map(toContractProperty),
    totalMatched,
    page,
    totalPages: Math.ceil(totalMatched / limit),
  });
};

// ----- Instant search -----------------------------------------------------------------------
const UNIT = "(crores?|cr|lakhs?|lacs?|l|k)?";
const NUM = "(\\d+(?:\\.\\d+)?)";
const money = (n, unit) => {
  const u = (unit || "").toLowerCase();
  const mult = u.startsWith("c") ? 1e7 : u.startsWith("l") ? 1e5 : u === "k" ? 1e3 : 1;
  return Math.round(parseFloat(n) * mult);
};

// "3bhk under 50 lakh in Whitefield" -> { bhk: 3, maxPrice: 5000000, place: "whitefield", text: "" }
function parseQuery(text) {
  let t = ` ${text.toLowerCase()} `;
  const out = {};
  const take = (re, fn) => {
    const m = t.match(re);
    if (m) {
      fn(m);
      t = t.replace(m[0], " ");
    }
  };
  take(new RegExp(`\\bbetween\\s+${NUM}\\s*${UNIT}\\s+(?:and|to|-)\\s+${NUM}\\s*${UNIT}\\b`), (m) => {
    out.minPrice = money(m[1], m[2] || m[4]);
    out.maxPrice = money(m[3], m[4]);
  });
  take(new RegExp(`\\b(?:under|below|less than|within|upto|up to|max)\\s+${NUM}\\s*${UNIT}\\b`), (m) => { out.maxPrice = money(m[1], m[2]); });
  take(new RegExp(`\\b(?:above|over|more than|min|starting|from)\\s+${NUM}\\s*${UNIT}\\b`), (m) => { out.minPrice = money(m[1], m[2]); });
  take(/\b(\d{1,2})\s*-?\s*bhk\b/, (m) => { out.bhk = Number(m[1]); });
  take(/\brera(?:\s*(?:approved|registered))?\b/, () => { out.rera = true; });
  take(/\bsemi[\s-]*furnished\b/, () => { out.furnishing = "semi"; });
  take(/\bun[\s-]*furnished\b/, () => { out.furnishing = "unfurnished"; });
  take(/\b(?:fully\s+)?furnished\b/, () => { out.furnishing = "furnished"; });
  take(/\bin\s+([\p{L}][\p{L}\s.-]{1,60}?)\s*$/u, (m) => { out.place = m[1].trim(); });
  out.text = t.replace(/\s+/g, " ").trim();
  return out;
}

function structured(p, { withPlace = true } = {}) {
  const conds = [PUBLIC];
  if (p.bhk) conds.push({ [ff("bhk")]: p.bhk });
  const price = range(ff("price"), p.minPrice ?? null, p.maxPrice ?? null);
  if (price) conds.push(price);
  if (p.rera) conds.push({ [ff("rera")]: true });
  if (p.furnishing) conds.push({ [ff("furnishing")]: p.furnishing });
  if (withPlace && p.place) conds.push(anyField(["city", "locality", "location.city", "location.locality"], new RegExp(escapeRegex(p.place), "i")));
  return conds;
}

const TEXT_FIELDS = ["title", "name", "projectName", "locality", "city", "propertyType", "developerName", "builderName"];

// Typo-tolerant fallback, as on the website: fuse.js over the listing's name and location.
const FUSE_OPTIONS = {
  keys: [{ name: "title", weight: 2 }, "locality", "city", "propertyType", "developerName"],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
};

function fuzzyMatches(words, docs, limit) {
  const records = docs.map((doc) => {
    const n = toContractProperty(doc);
    return { doc, title: n.title, locality: n.locality, city: n.city, propertyType: n.propertyType, developerName: n.developerName };
  });
  // Every word has to match one of the fields (a misspelt place and a type, say).
  const keys = FUSE_OPTIONS.keys.map((k) => k.name || k);
  const query = { $and: words.map((w) => ({ $or: keys.map((k) => ({ [k]: w })) })) };
  return new Fuse(records, FUSE_OPTIONS).search(query, { limit }).map((r) => r.item.doc);
}

const searchProperties = async (req, res) => {
  const limit = intIn(req.query.limit, 5, 1, 10);
  const query = sanitize(req.query.query);
  if (!query) return res.json({ properties: [], fuzzy: false });
  const p = parseQuery(query);
  const words = p.text.split(" ").filter((w) => w.length > 1);
  const sort = { featured: -1, ...byNewest };
  const find = (conds) => Property.find(and(conds)).sort(sort).limit(limit).lean();

  // 1. Exact phrase in a title / location field; 2. every word somewhere (regex).
  if (p.text) {
    const phrase = new RegExp(`^${escapeRegex(p.text)}$`, "i");
    let docs = await find([...structured(p), anyField(TEXT_FIELDS, phrase)]);
    if (!docs.length)
      docs = await find([...structured(p), ...words.map((w) => anyField(TEXT_FIELDS, new RegExp(escapeRegex(w), "i")))]);
    if (docs.length) return res.json({ properties: docs.map((d) => toCard(d, "search")), fuzzy: false });
  } else {
    const docs = await find(structured(p));
    if (docs.length) return res.json({ properties: docs.map((d) => toCard(d, "search")), fuzzy: false });
  }

  // 3. Fuzzy over recent listings that pass the structured filters (the place is matched fuzzily too).
  const fuzzyWords = [...words, ...(p.place ? p.place.split(/\s+/) : [])].filter((w) => w.length > 2);
  if (!fuzzyWords.length) return res.json({ properties: [], fuzzy: false });
  const pool = await Property.find(and(structured(p, { withPlace: false }))).sort(byNewest).limit(500).lean();
  const ranked = fuzzyMatches(fuzzyWords, pool, limit);
  const OMIT = ["state", "galleryImages", "reraApproved"]; // not guaranteed on fuzzy results
  res.json({
    properties: ranked.map((d) => Object.fromEntries(Object.entries(toCard(d, "search")).filter(([k]) => !OMIT.includes(k)))),
    fuzzy: ranked.length > 0,
  });
};

// ----- Detail -------------------------------------------------------------------------------
const findPublic = (id) => Property.findOne(and([PUBLIC, { _id: propertyIdMatch(id) }])).lean();

const getRelated = async (req, res) => {
  if (!isPropertyId(req.params.id)) return fail(res, 400, "Invalid property ID.");
  const doc = await findPublic(req.params.id);
  if (!doc) return fail(res, 404, "Property not found.");
  const n = toContractProperty(doc);
  const or = [];
  if (n.developerName) or.push(anyField(["developerName", "builderName"], exact(n.developerName)));
  if (n.locality && n.city) or.push(and([anyField(FIELDS.locality, exact(n.locality)), anyField(FIELDS.city, exact(n.city))]));
  if (!or.length) return res.json([]);
  const docs = await Property.find(and([PUBLIC, { _id: { $ne: doc._id } }, { $or: or }])).sort(byNewest).limit(10).lean();
  res.json(docs.map((d) => toCard(d, "related")));
};

const getProperty = async (req, res) => {
  if (!isPropertyId(req.params.id)) return fail(res, 400, "Invalid property ID.");
  const doc = await findPublic(req.params.id);
  if (!doc) return fail(res, 404, "Property not found.");
  res.json(toContractProperty(doc));
};

module.exports = {
  getFilters, getLocalitiesByType, getLocalitiesByCity, getLocationOptions, getFeatured, getRecent,
  getProperties, searchProperties, getRelated, getProperty, parseQuery,
};
