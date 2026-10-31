// Pure helpers for the guided Post Property flow (no React / no network), so they can be unit tested.

// Labels shown to the user -> values the existing backend understands.
// "Sell" is stored as listingType "sale" because that is what POST /post-property accepts.
export const LISTING_OPTIONS = [
  { label: "Sell", value: "sale", icon: "home-outline" },
  { label: "Rent", value: "rent", icon: "key-outline" },
];
export const CATEGORY_OPTIONS = [
  { label: "Residential", value: "residential", icon: "home-outline" },
  { label: "Commercial", value: "commercial", icon: "business-outline" },
];

export const RESIDENTIAL_TYPES = ["Flats/Apartments", "Villa", "Independent House", "Plot", "Builder Floor"];
export const COMMERCIAL_TYPES = ["Office", "Shop", "Showroom", "Warehouse", "Industrial", "Commercial Land", "Co-working Space"];

export const STEPS = [
  { key: "purpose", title: "Purpose, Category, Type & Location", subtitle: "Get the right tenants or buyers." },
  { key: "specs", title: "Specifications", subtitle: "Add property specifications." },
  { key: "pricing", title: "Pricing & Availability", subtitle: "Set the price and availability." },
  { key: "amenities", title: "Amenities & Features", subtitle: "Add amenities and features." },
  { key: "details", title: "Description & Photos", subtitle: "Describe it and add photos." },
  { key: "review", title: "Review & Submit", heading: "Review your listing", subtitle: "Check and confirm your details." },
];

// Icons shown beside dropdown options (and in the field once one is chosen).
export const TYPE_ICONS = {
  "Flats/Apartments": "business-outline", Villa: "home-outline", "Independent House": "home", Plot: "map-outline",
  "Builder Floor": "layers-outline", Office: "briefcase-outline", Shop: "storefront-outline", Showroom: "pricetags-outline",
  Warehouse: "cube-outline", Industrial: "construct-outline", "Commercial Land": "map-outline", "Co-working Space": "people-outline",
};
export const PARKING_ICONS = { "Car Parking": "car-outline", "Bike Parking": "bicycle-outline", "Car & Bike": "car-sport-outline", None: "close-circle-outline" };
export const FURNISHING_ICONS = { Unfurnished: "square-outline", "Semi-furnished": "bed-outline", Furnished: "tv-outline" };

export const CUSTOM_DATE = "Custom date";
export const RENT_AVAILABILITY = ["Immediately", "Within 15 days", "Within 1 month", CUSTOM_DATE];
export const SALE_POSSESSION = ["Ready to Move", "Under Construction", "New Launch", "Upcoming"];
export const FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];
export const FURNISHING = ["Unfurnished", "Semi-furnished", "Furnished"];
export const PARKING = ["Car Parking", "Bike Parking", "Car & Bike", "None"];
export const BHKS = ["1", "2", "3", "4", "5", "6+"];
export const BATHROOMS = ["1", "2", "3", "4", "5", "6", "7", "8"];
export const AREA_UNITS = [
  { label: "Sq.Ft", value: "sqft", toSqft: 1 },
  { label: "Sq.Yd", value: "sqyd", toSqft: 9 },
  { label: "Sq.M", value: "sqm", toSqft: 10.7639 },
];
export const AMENITIES = {
  residential: [
    "Lift", "Power Backup", "Security", "CCTV", "Parking", "Air Conditioning", "Club House", "Gym", "Swimming Pool",
    "Garden", "Children's Play Area", "Intercom", "Fire Safety", "High-speed Internet", "Visitor Parking",
    "Gated Community", "Rain Water Harvesting", "Solar Panels",
  ],
  commercial: [
    "Lift", "Power Backup", "Security", "CCTV", "Parking", "Air Conditioning", "Conference Room", "Cafeteria",
    "Fire Safety", "Reception", "High-speed Internet", "Washrooms", "Intercom", "Visitor Parking",
    "Rain Water Harvesting", "Solar Panels",
  ],
};
// Photos after the cover; the backend keeps 8 images in total.
export const MAX_PHOTOS = 7;

export const EMPTY_FORM = {
  listingType: "", category: "", propertyType: "",
  city: "", locality: "",
  bhk: "", area: "", areaUnit: "sqft", bathrooms: "", totalFloors: "", facing: "", parking: "", furnishing: "",
  price: "", availability: "", availableDate: "",
  amenities: [],
  cover: null, // { uri, url }
  photos: [], // [{ id, uri, url, room }]
  description: "",
  agreed: false,
};

const num = (v) => Number(String(v ?? "").replace(/,/g, ""));
export const isLandType = (t) => /plot|land/i.test(t || "");
// BHK is only meaningful for residential, non-plot property types.
export const needsBhk = (category, type) => category === "residential" && !!type && !isLandType(type);
export const showsBuildingFields = (type) => !!type && !isLandType(type);
export const typesFor = (category) => (category === "commercial" ? COMMERCIAL_TYPES : RESIDENTIAL_TYPES);
export const typeLabel = (t) => (t === "Flats/Apartments" ? "Apartment" : t);
export const priceLabel = (listingType) => (listingType === "rent" ? "Monthly Rent" : "Price");
export const amenitiesFor = (category) => AMENITIES[category] || AMENITIES.residential;
export const photoRoomsFor = (category, type) => {
  if (isLandType(type)) return ["Site", "Surroundings", "Other"];
  if (category === "commercial") return ["Front View", "Interior", "Washroom", "Parking", "Other"];
  return ["Hall", "Bedroom", "Kitchen", "Bathroom", "Balcony", "Other"];
};
export const areaInSqft = (f) => {
  const unit = AREA_UNITS.find((u) => u.value === f.areaUnit) || AREA_UNITS[0];
  return Math.round(num(f.area) * unit.toSqft);
};

// "DD/MM/YYYY" -> Date, or null when it isn't a real calendar date.
export function parseDate(text) {
  const m = String(text || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

// Types the slashes for the user as they enter a date.
export const maskDate = (text) => {
  const d = String(text).replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
};

export function availabilityText(f) {
  if (f.availability !== CUSTOM_DATE) return f.availability;
  const date = parseDate(f.availableDate);
  return date ? `Available from ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "";
}

// Listing titles across the app read "2 BHK Apartment for Rent in Andheri West".
export function buildTitle(f) {
  const type = typeLabel(f.propertyType);
  const what = needsBhk(f.category, f.propertyType) && f.bhk ? `${f.bhk} BHK ${type}` : type;
  return `${what} for ${f.listingType === "rent" ? "Rent" : "Sale"} in ${f.locality.trim()}`.slice(0, 120);
}

export function validateStep(stepKey, f) {
  const e = {};
  if (stepKey === "purpose") {
    if (!f.listingType) e.listingType = "Choose Rent or Sell";
    if (!f.category) e.category = "Select a property category";
    if (!f.propertyType || !typesFor(f.category).includes(f.propertyType)) e.propertyType = "Select a property type";
    if (!(f.city || "").trim()) e.city = "City is required";
    if (!(f.locality || "").trim()) e.locality = "Locality is required";
  } else if (stepKey === "specs") {
    if (needsBhk(f.category, f.propertyType) && !f.bhk) e.bhk = "Select the number of bedrooms";
    if (!(num(f.area) > 0)) e.area = "Enter a valid area";
    if (f.totalFloors !== "" && showsBuildingFields(f.propertyType)) {
      const n = num(f.totalFloors);
      if (!(Number.isInteger(n) && n >= 1 && n <= 200)) e.totalFloors = "Enter 1–200";
    }
  } else if (stepKey === "pricing") {
    if (!(num(f.price) > 0)) e.price = f.listingType === "rent" ? "Enter a valid monthly rent in ₹" : "Enter a valid price in ₹";
    if (f.listingType === "rent" && f.availability === CUSTOM_DATE) {
      const date = parseDate(f.availableDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!date) e.availableDate = "Enter a date as DD/MM/YYYY";
      else if (date < today) e.availableDate = "Choose today or a later date";
    }
  } else if (stepKey === "details") {
    if ((f.description || "").trim().length < 10) e.description = "Add a short description (10+ characters)";
    if (!f.cover?.url) e.cover = "Add a cover image";
    if ((f.photos || []).length > MAX_PHOTOS) e.photos = `You can add up to ${MAX_PHOTOS} more photos`;
  } else if (stepKey === "review") {
    if (!f.agreed) e.agreed = "Please accept the terms to submit";
  }
  return e;
}

// Returns { stepIndex, errors } for the first invalid step, or null when everything is valid.
export function firstInvalidStep(f) {
  for (let i = 0; i < STEPS.length; i += 1) {
    const errors = validateStep(STEPS[i].key, f);
    if (Object.keys(errors).length) return { stepIndex: i, errors };
  }
  return null;
}

// Builds the body for the existing POST /post-property contract.
export function buildPayload(f) {
  const building = showsBuildingFields(f.propertyType);
  const payload = {
    title: buildTitle(f),
    city: f.city.trim(),
    locality: f.locality.trim(),
    propertyType: f.propertyType,
    listingType: f.listingType,
    category: f.category,
    bhk: needsBhk(f.category, f.propertyType) ? f.bhk : "",
    price: String(f.price).replace(/,/g, ""),
    area: String(areaInSqft(f)),
    description: f.description.trim(),
  };
  if (f.bathrooms && building) payload.bathrooms = f.bathrooms;
  if (f.totalFloors && building) payload.totalFloors = f.totalFloors;
  if (f.parking) payload.parking = f.parking;
  if (f.furnishing && building) payload.furnishing = f.furnishing;
  if (f.facing && f.category === "residential") payload.facing = f.facing;
  const availability = availabilityText(f);
  if (availability) payload.possessionStatus = availability;
  if (f.amenities.length) payload.amenities = f.amenities;
  const images = [f.cover?.url, ...f.photos.map((p) => p.url)].filter(Boolean);
  if (images.length) payload.images = images;
  return payload;
}

// Drops values that don't apply after the user changes the category or property type
// (e.g. Residential -> Commercial, Villa -> Plot).
export function sanitizeForType(f) {
  const next = { ...f };
  if (next.propertyType && !typesFor(next.category).includes(next.propertyType)) next.propertyType = "";
  if (!needsBhk(next.category, next.propertyType)) next.bhk = "";
  if (!showsBuildingFields(next.propertyType)) {
    next.bathrooms = "";
    next.totalFloors = "";
    next.furnishing = "";
  }
  if (next.category !== "residential") next.facing = "";
  const availability = next.listingType === "rent" ? RENT_AVAILABILITY : SALE_POSSESSION;
  if (next.availability && !availability.includes(next.availability)) next.availability = "";
  const rooms = photoRoomsFor(next.category, next.propertyType);
  next.photos = next.photos.map((p) => (rooms.includes(p.room) ? p : { ...p, room: "Other" }));
  return next;
}
