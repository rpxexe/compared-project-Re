const mongoose = require("mongoose");
const { Property, User, Review, PropertyRating } = require("../models");
const { AppError, bad } = require("../utils/errors");
const {
  requireObjectId,
  isObjectId,
  paging,
  str,
} = require("../utils/validate");
const { normalizeProperty } = require("../utils/property");
const {
  buildPropertyFilter,
  buildSort,
  SECTIONS,
  PUBLIC,
} = require("../utils/propertyQuery");
const { summarise, publicRating } = require("../utils/rating");
const { cached } = require("../utils/cache");

// Filter lists and section counts change only when listings are added/approved; a short
// cache turns several full-collection scans per app launch into one every couple of minutes.
const FACETS_TTL_MS = 2 * 60 * 1000;

async function withRatings(docs) {
  const items = docs.map(normalizeProperty);
  if (!items.length) return items;
  const ratings = await PropertyRating.find({
    property: {
      $in: items
        .filter((i) => isObjectId(i.id))
        .map((i) => new mongoose.Types.ObjectId(i.id)),
    },
  }).lean();
  const map = new Map(ratings.map((r) => [String(r.property), r]));
  for (const it of items) it.rating = publicRating(map.get(it.id));
  return items;
}

// GET /api/properties – search / filter / sort / paginate. Everything is done in MongoDB.
const getProperties = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = buildPropertyFilter(req.query);
  const sort = str(req.query.sort, 12);

  if (sort === "rating") {
    const ranked = await PropertyRating.find({ count: { $gte: 1 } })
      .sort({ average: -1, count: -1 })
      .limit(300)
      .lean();
    const order = ranked.map((r) => String(r.property));
    const docs = order.length
      ? await Property.find({
          $and: [filter, { _id: { $in: ranked.map((r) => r.property) } }],
        }).lean()
      : [];
    docs.sort(
      (a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)),
    );
    const items = await withRatings(docs.slice(skip, skip + limit));
    return res.json({
      items,
      total: docs.length,
      page,
      pages: Math.max(1, Math.ceil(docs.length / limit)),
    });
  }

  const [docs, total] = await Promise.all([
    Property.find(filter).sort(buildSort(sort)).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  res.json({
    items: await withRatings(docs),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
};

// GET /api/properties/categories – which "New Project" categories actually have data.
const loadCategoryCounts = cached(FACETS_TTL_MS, async () => {
  const keys = [
    "projects",
    "new-launch",
    "upcoming",
    "under-construction",
    "ready",
  ];
  const counts = await Promise.all(
    keys.map((k) => Property.countDocuments({ $and: [PUBLIC, SECTIONS[k]] })),
  );
  const out = {};
  keys.forEach((k, i) => {
    out[k] = counts[i];
  });
  return out;
});

const getPropertyCategories = async (req, res) => {
  res.json({ counts: await loadCategoryCounts() });
};

// Filter option lists used by the app's filter sheet (values that really exist in the data).
const loadFacets = cached(FACETS_TTL_MS, async () => {
  const [cities, localities, types] = await Promise.all([
    Property.distinct("city", PUBLIC),
    Property.distinct("locality", PUBLIC),
    Property.distinct("propertyType", PUBLIC),
  ]);
  const clean = (arr) =>
    arr
      .filter((v) => typeof v === "string" && v.trim())
      .map((v) => v.trim())
      .sort()
      .slice(0, 100);
  return {
    cities: clean(cities),
    localities: clean(localities),
    propertyTypes: clean(types),
  };
});

const getFacets = async (req, res) => {
  res.json(await loadFacets());
};

let locationsCache = null;
let locationsCacheExpiry = 0;
const LOCATIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min memory cache to prevent heavy aggregate scans

const getLocations = async (req, res) => {
  try {
    const now = Date.now();
    let allLocations = locationsCache;

    if (!allLocations || now > locationsCacheExpiry) {
      const list = await Property.aggregate([
        { $match: PUBLIC },
        {
          $group: {
            _id: { locality: "$locality", city: "$city" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            locality: "$_id.locality",
            city: "$_id.city",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 300 },
      ]);
      allLocations = list
        .filter((l) => (l.city && l.city.trim()) || (l.locality && l.locality.trim()))
        .map((l) => ({
          locality: (l.locality || "").trim(),
          city: (l.city || "").trim(),
          formatted: [l.locality, l.city].filter(Boolean).map((s) => s.trim()).join(", "),
          count: l.count,
        }));
      locationsCache = allLocations;
      locationsCacheExpiry = now + LOCATIONS_CACHE_TTL_MS;
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = (req.query.search || req.query.q || "").trim().toLowerCase();

    let filtered = allLocations;
    if (search) {
      filtered = allLocations.filter(
        (l) =>
          l.locality.toLowerCase().includes(search) ||
          l.city.toLowerCase().includes(search) ||
          l.formatted.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);
    const hasMore = skip + paged.length < total;

    res.json({
      locations: paged,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const getTopRatedProperties = async (req, res) => {
  const limit = Math.min(
    20,
    Math.max(1, parseInt(str(req.query.limit, 3), 10) || 8),
  );
  const ranked = await PropertyRating.find({ count: { $gte: 1 } })
    .sort({ average: -1, count: -1 })
    .limit(limit * 3)
    .lean();
  const order = ranked.map((r) => String(r.property));
  const docs = order.length
    ? await Property.find({
        $and: [PUBLIC, { _id: { $in: ranked.map((r) => r.property) } }],
      }).lean()
    : [];
  docs.sort(
    (a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)),
  );
  res.json({ items: await withRatings(docs.slice(0, limit)) });
};

const getCompareProperties = async (req, res) => {
  const ids = [
    ...new Set(
      str(req.query.ids, 300)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > 4) throw bad("You can compare up to 4 projects at a time");
  if (ids.some((id) => !isObjectId(id))) throw bad("Invalid property id");
  if (!ids.length) return res.json({ items: [] });
  const docs = await Property.find({
    $and: [
      PUBLIC,
      { _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } },
    ],
  }).lean();
  const items = await withRatings(docs);
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  res.json({ items });
};

const getSavedProperties = async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  const ids = (user?.savedProperties || []).map(String);
  const docs = ids.length
    ? await Property.find({
        _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
      }).lean()
    : [];
  const items = await withRatings(docs);
  items.sort((a, b) => ids.indexOf(b.id) - ids.indexOf(a.id)); // most recently saved first
  res.json({ items });
};

const getProperty = async (req, res) => {
  requireObjectId(req.params.id, "property id");
  const doc = await Property.findById(req.params.id).lean();
  const hidden = doc && ["pending", "rejected"].includes(doc.approvalStatus);
  const isOwner = Boolean(
    req.user && doc?.ownerUserId && String(doc.ownerUserId) === req.user.id,
  );
  if (!doc || (hidden && !isOwner))
    throw new AppError(404, "Property not found");
  const [item] = await withRatings([doc]);
  res.json({ property: { ...item, isOwner } });
};

async function setSaved(req, res, desired) {
  requireObjectId(req.params.id, "property id");
  const exists = await Property.findById(req.params.id).lean();
  if (!exists) throw new AppError(404, "Property not found");
  const id = new mongoose.Types.ObjectId(req.params.id);
  const user = await User.findById(req.user.id).lean();
  const currently = (user?.savedProperties || []).some(
    (x) => String(x) === String(id),
  );
  const next = desired === undefined ? !currently : desired;
  await User.updateOne(
    { _id: req.user.id },
    next
      ? { $addToSet: { savedProperties: id } }
      : { $pull: { savedProperties: id } },
  );
  res.json({ saved: next });
}
// Body {saved:true|false} makes the call idempotent; with no body it toggles.

const saveProperty = async (req, res) => {
  await setSaved(
    req,
    res,
    typeof req.body?.saved === "boolean" ? req.body.saved : undefined,
  );
};

const deleteSavedProperty = async (req, res) => {
  await setSaved(req, res, false);
};

// ----- Ratings & reviews -------------------------------------------------------------------
async function recompute(propertyId) {
  // Only the rating is needed; skip comments/user data to keep this cheap on busy listings.
  const reviews = await Review.find({ property: propertyId }).select("rating").lean();
  const s = summarise(reviews);
  await PropertyRating.findOneAndUpdate(
    { property: propertyId },
    {
      $set: {
        average: s.average,
        count: s.count,
        distribution: s.distribution,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return s;
}

const getReviews = async (req, res) => {
  requireObjectId(req.params.id, "property id");
  const propertyId = new mongoose.Types.ObjectId(req.params.id);
  const { page, limit, skip } = paging(req.query, {
    defLimit: 10,
    maxLimit: 30,
  });
  const [all, items] = await Promise.all([
    Review.find({ property: propertyId }).lean(),
    Review.find({ property: propertyId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  const summary = summarise(all);
  const mine = req.user
    ? all.find((r) => String(r.user) === req.user.id)
    : null;
  const shape = (r) => ({
    id: String(r._id),
    rating: r.rating,
    comment: r.comment || "",
    userName: r.userName || "Verified user",
    createdAt: r.createdAt,
    mine: Boolean(req.user && String(r.user) === req.user.id),
  });
  res.json({
    summary,
    items: items.map(shape),
    myReview: mine ? shape(mine) : null,
    page,
    pages: Math.max(1, Math.ceil(summary.count / limit)),
  });
};

const postReview = async (req, res) => {
  requireObjectId(req.params.id, "property id");
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw bad("Rating must be a whole number from 1 to 5");
  const comment = str(req.body?.comment, 500);
  const property = await Property.findById(req.params.id).lean();
  if (!property || ["pending", "rejected"].includes(property.approvalStatus))
    throw new AppError(404, "Property not found");
  if (property.ownerUserId && String(property.ownerUserId) === req.user.id)
    throw new AppError(403, "You cannot rate your own listing");

  const propertyId = new mongoose.Types.ObjectId(req.params.id);
  const user = await User.findById(req.user.id).lean();
  const review = await Review.findOneAndUpdate(
    { property: propertyId, user: new mongoose.Types.ObjectId(req.user.id) },
    {
      $set: {
        rating,
        comment,
        userName: (user?.name || "").split(" ")[0] || "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const summary = await recompute(propertyId);
  res.status(201).json({
    review: {
      id: String(review._id),
      rating: review.rating,
      comment: review.comment,
    },
    summary,
  });
};

const deleteReview = async (req, res) => {
  requireObjectId(req.params.id, "property id");
  const propertyId = new mongoose.Types.ObjectId(req.params.id);
  await Review.deleteOne({
    property: propertyId,
    user: new mongoose.Types.ObjectId(req.user.id),
  });
  res.json({ summary: await recompute(propertyId) });
};

exports.getProperties = getProperties;
exports.getPropertyCategories = getPropertyCategories;
exports.getFacets = getFacets;
exports.getLocations = getLocations;
exports.getTopRatedProperties = getTopRatedProperties;
exports.getCompareProperties = getCompareProperties;
exports.getSavedProperties = getSavedProperties;
exports.getProperty = getProperty;
exports.saveProperty = saveProperty;
exports.deleteSavedProperty = deleteSavedProperty;
exports.getReviews = getReviews;
exports.postReview = postReview;
exports.deleteReview = deleteReview;
// Used by admin review moderation to refresh a property's rating summary.
exports.recompute = recompute;
