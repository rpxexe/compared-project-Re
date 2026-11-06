// Listing documents in the shape of the mobile API contract (MOBILE_API.md). The collection
// holds imports with differing field names, so the contract's fields are filled from the
// normalised values and filterFields; the remaining original fields are passed through.
const { normalizeProperty, firstString } = require("./property");
const { compute, FIELD } = require("./filterFields");

// Internal / moderation fields that never leave the API.
const HIDDEN = [
  FIELD, "ownerUserId", "ownerRole", "contactPhone", "contactName", "reviewedBy", "reviewedAt",
  "rejectionReason", "approvalStatus", "dataSource", "__v",
];

const image = (url) => (url ? { url } : null);

function toContractProperty(doc) {
  const n = normalizeProperty(doc);
  const f = doc[FIELD] || compute(doc);
  const loc = doc.location && typeof doc.location === "object" ? doc.location : {};
  const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => !HIDDEN.includes(k)));
  // Links a client opens are passed through only as https:// (as in the v1 API).
  for (const k of ["brochure", "mapLink", "virtualTours"]) if (k in rest) rest[k] = n[k];
  return {
    ...rest,
    _id: String(doc._id),
    title: n.title,
    description: n.description,
    long_description: n.longDescription,
    state: firstString(doc.state, loc.state) || null,
    city: n.city,
    locality: n.locality,
    address: n.address,
    pincode: n.pincode || null,
    price: f.price ?? null,
    bhk: f.bhk ?? null,
    area: f.areaSqft ? { value: f.areaSqft, unit: "sqft" } : null,
    furnishing: n.furnishing,
    propertyType: n.propertyType,
    possessionStatus: n.possessionStatus,
    developerName: n.developerName,
    reraNumber: n.reraNumber,
    reraApproved: f.rera === true,
    coverImage: image(n.image),
    galleryImages: n.galleryImages.map(image),
    amenities: n.amenities,
    featured: n.featured,
    slug: doc.slug || null,
    createdAt: f.postedAt || doc.createdAt || null,
  };
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]));

const pricePerSqft = (p) => (p.price && p.area?.value ? Math.round(p.price / p.area.value) : null);

// Card field lists, per endpoint, as the contract lists them.
const CARDS = {
  featured: ["_id", "title", "city", "locality", "price", "bhk", "furnishing", "area", "reraDate", "coverImage",
    "pricePerSqft", "developerName", "propertyType", "galleryImages", "reraNumber", "possessionStatus", "description"],
  recent: ["_id", "title", "city", "locality", "price", "bhk", "furnishing", "area", "coverImage", "developerName",
    "propertyType", "slug", "createdAt"],
  related: ["_id", "title", "price", "bhk", "area", "coverImage", "createdAt", "developerName", "slug", "propertyType", "locality"],
  search: ["_id", "title", "locality", "city", "state", "price", "coverImage", "galleryImages", "propertyType", "bhk",
    "furnishing", "reraApproved", "possessionStatus", "area", "ageOfProperty", "developerName"],
  activity: ["_id", "title", "price", "coverImage", "locality", "city", "propertyType", "bhk"],
};

function toCard(doc, kind) {
  const p = toContractProperty(doc);
  return pick({ ...p, pricePerSqft: pricePerSqft(p), reraDate: doc.reraDate || null }, CARDS[kind]);
}

module.exports = { toContractProperty, toCard };
