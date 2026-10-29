// Pure helpers for the guided Post Property flow (no React / no network), so they can be unit tested.
import { isValidIndianMobile } from "./validators.js";

// Labels shown to the user -> values the existing backend understands.
// "Resale" is stored as listingType "sale" because that is what POST /post-property accepts.
export const LISTING_OPTIONS = [
  { label: "Rent", value: "rent", icon: "key-outline", hint: "Let your property to a tenant" },
  { label: "Resale", value: "sale", icon: "pricetag-outline", hint: "Sell your property to a buyer" },
];
export const CATEGORY_OPTIONS = [
  { label: "Residential", value: "residential", icon: "home-outline", hint: "Flats, villas, houses, plots" },
  { label: "Commercial", value: "commercial", icon: "business-outline", hint: "Offices, shops, warehouses" },
];

export const RESIDENTIAL_TYPES = ["Flats/Apartments", "Villa", "Independent House", "Plot", "Builder Floor"];
export const COMMERCIAL_TYPES = ["Office", "Shop", "Showroom", "Warehouse", "Industrial", "Commercial Land", "Co-working Space"];

export const STEPS = [
  { key: "basics", title: "Basic details", subtitle: "Tell people what you're listing", icon: "home-outline" },
  { key: "location", title: "Location", subtitle: "Where is the property?", icon: "location-outline" },
  { key: "specs", title: "Specifications", subtitle: "Size and configuration", icon: "resize-outline" },
  { key: "pricing", title: "Pricing & availability", subtitle: "Set the price and availability", icon: "cash-outline" },
  { key: "amenities", title: "Amenities & features", subtitle: "Select everything that applies", icon: "sparkles-outline" },
  { key: "photos", title: "Photos", subtitle: "Add image links to showcase it", icon: "images-outline" },
  { key: "review", title: "Description & review", subtitle: "Final details, then submit", icon: "checkmark-done-outline" },
];

export const RENT_AVAILABILITY = ["Immediately", "Within 15 days", "Within 1 month", "After 1 month"];
export const SALE_POSSESSION = ["Ready to Move", "Under Construction", "New Launch", "Upcoming"];
export const FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];
export const FURNISHING = ["Unfurnished", "Semi-furnished", "Furnished"];
export const BHKS = ["1", "2", "3", "4", "5", "6+"];
export const AMENITIES = {
  residential: ["Lift", "Power Backup", "Security", "CCTV", "Gym", "Swimming Pool", "Clubhouse", "Garden", "Play Area", "Gated Community", "Visitor Parking", "Water Supply"],
  commercial: ["Lift", "Power Backup", "Security", "CCTV", "Parking", "Air Conditioning", "Conference Room", "Cafeteria", "Fire Safety", "Reception", "High-speed Internet", "Washrooms"],
};
export const MAX_IMAGES = 8;

export const EMPTY_FORM = {
  title: "", propertyType: "", availability: "",
  city: "", locality: "",
  bhk: "", bathrooms: "", area: "", floor: "", facing: "", parking: "", furnishing: "",
  price: "",
  amenities: [], images: [],
  description: "", contactName: "", contactPhone: "",
};

const num = (v) => Number(String(v ?? "").replace(/,/g, ""));
export const isLandType = (t) => /plot|land/i.test(t || "");
// BHK is only meaningful for residential, non-plot property types.
export const needsBhk = (category, type) => category === "residential" && !!type && !isLandType(type);
export const showsBathrooms = (type) => !!type && !isLandType(type);
export const showsFurnishing = (type) => !!type && !isLandType(type);
export const showsFloor = (type) => !!type && !isLandType(type);
export const typesFor = (category) => (category === "commercial" ? COMMERCIAL_TYPES : RESIDENTIAL_TYPES);
export const priceLabel = (listingType) => (listingType === "rent" ? "Monthly rent (₹)" : "Expected price (₹)");
export const isHttpUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || "").trim());

export function validateStep(stepKey, f, ctx) {
  const e = {};
  const { category, listingType } = ctx;
  if (stepKey === "basics") {
    if ((f.title || "").trim().length < 3) e.title = "Enter a title (at least 3 characters)";
    if (!f.propertyType) e.propertyType = "Select a property type";
    else if (!typesFor(category).includes(f.propertyType)) e.propertyType = "Select a property type";
  } else if (stepKey === "location") {
    if (!(f.city || "").trim()) e.city = "City is required";
    if (!(f.locality || "").trim()) e.locality = "Locality is required";
  } else if (stepKey === "specs") {
    if (needsBhk(category, f.propertyType) && !f.bhk) e.bhk = "Select the number of bedrooms";
    if (!(num(f.area) > 0)) e.area = "Enter a valid area in sq.ft";
    if (f.bathrooms !== "" && showsBathrooms(f.propertyType)) {
      const b = num(f.bathrooms);
      if (!(Number.isInteger(b) && b >= 0 && b <= 20)) e.bathrooms = "Enter a number between 0 and 20";
    }
  } else if (stepKey === "pricing") {
    if (!(num(f.price) > 0)) e.price = listingType === "rent" ? "Enter a valid monthly rent in ₹" : "Enter a valid price in ₹";
  } else if (stepKey === "photos") {
    const bad = (f.images || []).some((u) => !isHttpUrl(u));
    if (bad) e.images = "Image links must start with http:// or https://";
    if ((f.images || []).length > MAX_IMAGES) e.images = `You can add up to ${MAX_IMAGES} images`;
  } else if (stepKey === "review") {
    if ((f.description || "").trim().length < 10) e.description = "Add a short description (10+ characters)";
    if (f.contactPhone && !isValidIndianMobile(f.contactPhone)) e.contactPhone = "Enter a valid 10-digit mobile number";
  }
  return e;
}

// Returns { stepIndex, errors } for the first invalid step, or null when everything is valid.
export function firstInvalidStep(f, ctx) {
  for (let i = 0; i < STEPS.length; i += 1) {
    const errors = validateStep(STEPS[i].key, f, ctx);
    if (Object.keys(errors).length) return { stepIndex: i, errors };
  }
  return null;
}

// Builds the body for the existing POST /post-property contract.
export function buildPayload(f, ctx) {
  const { listingType, category } = ctx;
  const land = isLandType(f.propertyType);
  const payload = {
    title: f.title.trim(),
    city: f.city.trim(),
    locality: f.locality.trim(),
    propertyType: f.propertyType,
    listingType,
    category,
    bhk: needsBhk(category, f.propertyType) ? f.bhk : "",
    price: String(f.price).replace(/,/g, ""),
    area: String(f.area).replace(/,/g, ""),
    description: f.description.trim(),
  };
  if (f.bathrooms !== "" && showsBathrooms(f.propertyType)) payload.bathrooms = f.bathrooms;
  if (f.parking.trim()) payload.parking = f.parking.trim();
  if (f.furnishing && showsFurnishing(f.propertyType)) payload.furnishing = f.furnishing;
  if (f.facing && category === "residential") payload.facing = f.facing;
  if (f.floor.trim() && !land) payload.floor = f.floor.trim();
  if (f.availability) payload.possessionStatus = f.availability;
  if (f.amenities.length) payload.amenities = f.amenities;
  if (f.images.length) payload.images = f.images;
  if (f.contactName.trim()) payload.contactName = f.contactName.trim();
  if (f.contactPhone) payload.contactPhone = f.contactPhone;
  return payload;
}

// Drops values that don't apply after the user changes the property type (e.g. Villa -> Plot).
export function sanitizeForType(f, category) {
  const next = { ...f };
  if (!needsBhk(category, next.propertyType)) next.bhk = "";
  if (!showsBathrooms(next.propertyType)) next.bathrooms = "";
  if (!showsFurnishing(next.propertyType)) next.furnishing = "";
  if (!showsFloor(next.propertyType)) next.floor = "";
  return next;
}
