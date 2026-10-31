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

// "Flats/Apartments" is the stored value the search filters already know; villas and independent
// houses share one option, which the backend files under its "House / Villa" filter.
export const RESIDENTIAL_TYPES = ["Flats/Apartments", "Villa/Independent House", "Plot", "Builder Floor"];
export const COMMERCIAL_TYPES = ["Office", "Shop", "Showroom", "Warehouse", "Industrial", "Commercial Land", "Co-working Space"];

export const STEPS = [
  { key: "purpose", title: "Basics, Price & Possession", subtitle: "Get the right tenants or buyers." },
  { key: "amenities", title: "Amenities & Features", subtitle: "Add amenities and features." },
  { key: "details", title: "Description & Photos", subtitle: "Describe it and add photos." },
  { key: "review", title: "Review & Submit", heading: "Review your listing", subtitle: "Check and confirm your details." },
];

// Icons shown beside dropdown options (and in the field once one is chosen).
export const TYPE_ICONS = {
  "Flats/Apartments": "business-outline", "Villa/Independent House": "home-outline", Plot: "map-outline",
  "Builder Floor": "layers-outline", Office: "briefcase-outline", Shop: "storefront-outline", Showroom: "pricetags-outline",
  Warehouse: "cube-outline", Industrial: "construct-outline", "Commercial Land": "map-outline", "Co-working Space": "people-outline",
};
export const PARKING_ICONS = { "Car Parking": "car-outline", "Bike Parking": "bicycle-outline", "Car & Bike": "car-sport-outline", None: "close-circle-outline" };
export const FURNISHING_ICONS = { Unfurnished: "square-outline", "Semi-furnished": "bed-outline", Furnished: "tv-outline" };

export const CUSTOM_DATE = "Custom date";
export const RENT_AVAILABILITY = ["Immediately", "Within 15 days", "Within 1 month", CUSTOM_DATE];
export const UNDER_CONSTRUCTION = "Under Construction";
export const SALE_POSSESSION = ["Ready to Move", UNDER_CONSTRUCTION];
// Worded so the backend's age filter buckets them (0-1, 1-5, 5-10, 10+).
export const PROPERTY_AGES = ["0-1 Years", "1-5 Years", "5-10 Years", "10+ Years"];
export const GROUND = "Ground";
export const FLOORS = [GROUND, ...Array.from({ length: 60 }, (_, i) => String(i + 1))];
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
// Amenities step, in sections. `field` is where choices are stored: "amenities" and
// "facilities" are lists (both shown on the listing page), "grade" is a single choice.
// `when` decides whether a section applies to the property being listed.
const isOffice = (f) => ["Office", "Co-working Space"].includes(f.propertyType);
const isRetail = (f) => ["Shop", "Showroom", "Commercial Land"].includes(f.propertyType);
const isWarehouse = (f) => ["Warehouse", "Industrial"].includes(f.propertyType);
const built = (f) => showsBuildingFields(f.propertyType);
const furnished = (f) => built(f) && ["Furnished", "Semi-furnished"].includes(f.furnishing);
const residential = (f) => f.category !== "commercial";
const commercial = (f) => f.category === "commercial";

export const AMENITY_SECTIONS = [
  // Residential
  { key: "society", short: "Society", title: "Building / Society", icon: "business-outline", field: "amenities", when: residential, items: [
    "Lift", "Service Lift", "24x7 Security", "CCTV Cameras", "Intercom", "Fire Fighting System", "Power Backup",
    "Society Office", "Maintenance Staff", "Biometric Entry", "Refuge Area"] },
  { key: "recreation", short: "Lifestyle", title: "Recreation / Lifestyle", icon: "barbell-outline", field: "amenities", when: residential, items: [
    "Swimming Pool", "Gymnasium", "Club House", "Indoor Games Room", "Children's Play Area", "Jogging Track",
    "Yoga / Meditation Area", "Multipurpose Hall", "Party Lawn", "Amphitheatre", "Library", "Senior Citizen Area",
    "Sports Turf", "Spa / Sauna"] },
  { key: "outdoor", short: "Outdoor", title: "Outdoor & Green Spaces", icon: "leaf-outline", field: "amenities", when: residential, items: [
    "Landscaped Garden", "Open Space", "Rooftop Garden", "Rooftop Amenities", "Walking Track", "Pet Park", "Water Body / Fountain"] },
  { key: "parking", short: "Parking", title: "Parking & Mobility", icon: "car-outline", field: "amenities", when: residential, items: [
    "Covered Parking", "Open Parking", "Stack Parking", "Puzzle Parking", "EV Charging Station", "Visitor Parking", "Two Wheeler Parking"] },
  { key: "home", short: "Apartment", title: "Apartment Features", icon: "home-outline", field: "amenities", when: (f) => residential(f) && built(f), items: [
    "Balcony", "Private Terrace", "Modular Kitchen", "False Ceiling", "Chimney", "Piped Gas", "Servant Room",
    "Solar Power", "Solar Water Heater", "Bath Tub", "Home Automation"] },
  { key: "water", short: "Water & Utilities", title: "Water, Utilities & Sustainability", icon: "water-outline", field: "amenities", when: residential, items: [
    "24x7 Water Supply", "Borewell", "Municipal Water Supply", "Water Storage", "Sewage Treatment Plant", "Rainwater Harvesting"] },
  { key: "flooring", short: "Flooring", title: "Flooring & Internal Walls", icon: "grid-outline", field: "facilities", when: (f) => residential(f) && built(f), items: [
    "Vitrified Flooring", "Marble Flooring", "Ceramic Flooring", "Mosaic Tiles", "Wooden Flooring", "Gypsum Walls",
    "Brick / Concrete Walls", "Wooden Wall Panels"] },
  { key: "homeFurnishing", short: "Furnishings", title: "Furnishings", icon: "bed-outline", field: "facilities", when: (f) => residential(f) && furnished(f), items: [
    "Sofa", "Bed", "TV Unit", "Wardrobe", "Cupboard", "TV", "Fridge", "Microwave Oven", "Washing Machine", "Water Purifier",
    "Gas Stove", "Kitchen Cabinets", "Dining Table", "Fans", "Lights", "Geyser"] },
  // Commercial
  { key: "infra", short: "Building", title: "Building & Infrastructure", icon: "business-outline", field: "amenities", when: (f) => commercial(f) && built(f), items: [
    "Lift / Elevator", "Service Lift", "Central AC", "Fire Safety", "Fire Alarm", "24x7 Security", "CCTV Cameras",
    "Visitor Management", "Reception / Lobby", "Power Backup", "Disabled Access / Ramp", "Refuge Area",
    "Facility Management", "Restaurant / Cafeteria"] },
  { key: "grade", short: "Grade", title: "Building Grade", icon: "ribbon-outline", field: "grade", when: (f) => commercial(f) && built(f), items: [
    "Grade A+", "Grade A", "Grade B", "Grade C"] },
  { key: "office", short: "Office", title: "Office Amenities", icon: "briefcase-outline", field: "amenities", when: (f) => commercial(f) && isOffice(f), items: [
    "Conference Room", "Private Cabin", "Director Cabin", "Open Workstations", "Reception Area", "False Ceiling", "Pantry",
    "Storage Room", "Balcony", "Terrace", "IT Infrastructure", "Male / Female Washrooms", "Private Washroom",
    "Common Washroom", "Housekeeping"] },
  { key: "retail", short: "Retail", title: "Retail & Showroom Features", icon: "storefront-outline", field: "amenities", when: (f) => commercial(f) && isRetail(f), items: [
    "Main Road Facing", "Corner Property", "Glass Frontage", "Display Windows", "Signage Space", "High Street Retail",
    "Mall Location", "Double Height Ceiling", "Mezzanine Floor", "High Footfall Location", "Shutter / Rolling Door",
    "Dedicated Customer Parking"] },
  { key: "warehouse", short: "Warehouse", title: "Warehouse & Industrial", icon: "cube-outline", field: "amenities", when: (f) => commercial(f) && isWarehouse(f), items: [
    "Loading Dock", "High Ceiling", "Industrial Flooring", "Goods Lift", "Truck / Container Access", "Fire Fighting System",
    "Sprinkler System"] },
  { key: "utilities", short: "Utilities", title: "Utilities & Services", icon: "flash-outline", field: "amenities", when: commercial, items: [
    "24x7 Water Supply", "Municipal Water Supply", "Three Phase Power", "Solar Power", "High-speed Internet"] },
  { key: "officeFurnishing", short: "Furnishings", title: "Furnishings", icon: "desktop-outline", field: "facilities", when: (f) => commercial(f) && furnished(f), items: [
    "Workstations", "Air Conditioning", "Water Filter", "Fans", "Lights", "Chairs", "Desks", "File Cabinets", "Wi-Fi"] },
];
export const MAX_AMENITIES = 120;
export const sectionsFor = (f) => AMENITY_SECTIONS.filter((sec) => sec.when(f));
const KNOWN = { amenities: new Set(), facilities: new Set() };
AMENITY_SECTIONS.forEach((sec) => sec.items.forEach((i) => KNOWN[sec.field]?.add(i)));
// Typed-in amenities are anything outside the preset lists.
export const isCustomAmenity = (a) => !KNOWN.amenities.has(a);
// Photos after the cover; the backend keeps 8 images in total.
export const MAX_PHOTOS = 7;

export const EMPTY_FORM = {
  listingType: "", category: "", propertyType: "",
  city: "", locality: "",
  bhk: "", area: "", areaUnit: "sqft", bathrooms: "", floor: "", totalFloors: "", facing: "", parking: "", furnishing: "",
  price: "", availability: "", availableDate: "", age: "",
  amenities: [], facilities: [], grade: "",
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
// Which floor the unit is on; a villa or house is the whole building.
export const showsFloor = (type) => showsBuildingFields(type) && type !== "Villa/Independent House";
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
// "Ground Floor" or "5th Floor", the wording the backend's floor filter reads. Total floors are
// sent on their own, and the listing page shows them as "5th Floor of 20".
export const floorText = (f) => (!f.floor ? "" : `${f.floor === GROUND ? "Ground" : ordinal(Number(f.floor))} Floor`);
// Age applies to built property that already stands.
export const showsAge = (f) => showsBuildingFields(f.propertyType) && !(f.listingType === "sale" && f.availability === UNDER_CONSTRUCTION);
export const typesFor = (category) => (category === "commercial" ? COMMERCIAL_TYPES : RESIDENTIAL_TYPES);
export const typeLabel = (t) => (t === "Flats/Apartments" ? "Apartment/Flat" : t);
export const priceLabel = (listingType) => (listingType === "rent" ? "Monthly Rent" : "Price");
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
    if (needsBhk(f.category, f.propertyType) && !f.bhk) e.bhk = "Select the number of bedrooms";
    if (!(num(f.area) > 0)) e.area = "Enter a valid area";
    if (f.totalFloors !== "" && showsBuildingFields(f.propertyType)) {
      const n = num(f.totalFloors);
      if (!(Number.isInteger(n) && n >= 1 && n <= 200)) e.totalFloors = "Enter 1–200";
    }
    if (f.floor && f.floor !== GROUND && f.totalFloors && num(f.floor) > num(f.totalFloors)) e.floor = "Can't be above the total floors";
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
  if (f.floor && showsFloor(f.propertyType)) payload.floor = floorText(f);
  if (f.parking) payload.parking = f.parking;
  if (f.furnishing && building) payload.furnishing = f.furnishing;
  if (f.facing && f.category === "residential") payload.facing = f.facing;
  const availability = availabilityText(f);
  if (availability) payload.possessionStatus = availability;
  if (f.age && showsAge(f)) payload.ageOfProperty = f.age;
  if (f.amenities.length) payload.amenities = f.amenities;
  if (f.facilities.length) payload.facilities = f.facilities;
  if (f.grade) payload.buildingGrade = f.grade;
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
  if (!showsFloor(next.propertyType)) next.floor = "";
  if (next.category !== "residential") next.facing = "";
  const availability = next.listingType === "rent" ? RENT_AVAILABILITY : SALE_POSSESSION;
  if (next.availability && !availability.includes(next.availability)) next.availability = "";
  if (!showsAge(next) || !PROPERTY_AGES.includes(next.age)) next.age = "";
  // Keep only choices from sections that still apply (plus typed-in amenities).
  const sections = sectionsFor(next);
  const offered = (field) => new Set(sections.filter((sec) => sec.field === field).flatMap((sec) => sec.items));
  const amenities = offered("amenities");
  const facilities = offered("facilities");
  next.amenities = (next.amenities || []).filter((a) => amenities.has(a) || isCustomAmenity(a));
  next.facilities = (next.facilities || []).filter((a) => facilities.has(a));
  if (!offered("grade").has(next.grade)) next.grade = "";
  const rooms = photoRoomsFor(next.category, next.propertyType);
  next.photos = next.photos.map((p) => (rooms.includes(p.room) ? p : { ...p, room: "Other" }));
  return next;
}
