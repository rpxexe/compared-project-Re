const express = require("express");
const { authRequired } = require("../middleware/auth");
const { rateLimit, byUser } = require("../utils/rateLimit");
const postProperty = require("../controllers/postProperty-controller");
const env = require("../config/env");
const { str, cleanPhone, isValidPhone } = require("../utils/validate");
const { isHttpsUrl } = require("../utils/zod");
const { z } = require("zod");

const router = express.Router();
const FURNISHING = ["unfurnished", "semi-furnished", "furnished"];
// Property types where "BHK" does not apply (kept in sync with the app's validators).
const NO_BHK = /plot|land|commercial|shop|showroom|office|warehouse|industrial|co-?working/i;

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const given = (v) => v !== undefined && v !== "";

// Listing photos must be https:// links. The one exception is development/test, where the
// API's own uploads are served over plain http from the dev machine (http://<lan-ip>:5000/uploads/<uuid>.jpg).
const OWN_UPLOAD_PATH = /^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
function isAllowedImageUrl(v) {
  if (isHttpsUrl(v, 500)) return true;
  if (!env.isDevLike || typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" && !u.username && !u.password && !u.search && OWN_UPLOAD_PATH.test(u.pathname);
  } catch {
    return false;
  }
}
const IMAGE_ERROR = "Image links must be secure https:// links";
const LINK_ERROR = "Links must be secure https:// web addresses";
// Optional external link (brochure, map) the app opens in the browser: https only, never
// tel:, upi:, intent:, javascript:, file: or plain http.
const httpsLink = () => z.preprocess(
  (v) => (given(v) && v !== null ? (typeof v === "string" ? v.trim() : v) : undefined),
  z.string({ error: LINK_ERROR }).refine((u) => isHttpsUrl(u), { error: LINK_ERROR }).optional(),
);

// Field helpers. Text is trimmed and cut to its maximum (as before) rather than rejected.
const text = (max) => z.preprocess((v) => str(v, max), z.string());
const optText = (max) => z.preprocess((v) => (v ? str(v, max) : undefined), z.string().optional());
const atLeast = (max, min, error) => z.preprocess((v) => str(v, max), z.string().min(min, { error }));
const positive = (error) => z.preprocess(num, z.number({ error }).gt(0, { error }));
const tags = (maxItems) => z.preprocess(
  (v) => (Array.isArray(v) ? [...new Set(v.map((a) => str(a, 40)).filter(Boolean))].slice(0, maxItems) : undefined),
  z.array(z.string()).optional(),
);
const lowerEnum = (values, maxLen, error) =>
  z.preprocess((v) => str(v, maxLen).toLowerCase() || undefined, z.enum(values, { error }).optional());

// The post-property form. Built per request because whether BHK is required depends on the
// category and property type that were sent.
function listingSchema(body) {
  const isCommercial = str(body.category, 20).toLowerCase() === "commercial";
  const needsBhk = !isCommercial && !NO_BHK.test(str(body.propertyType, 60));
  const floorsError = "Enter total floors between 1 and 200";
  return z.object({
    title: atLeast(120, 3, "Enter a property title (at least 3 characters)"),
    city: atLeast(60, 1, "City is required"),
    locality: atLeast(80, 1, "Locality is required"),
    propertyType: atLeast(60, 1, "Select a property type"),
    bhk: needsBhk ? text(3).pipe(z.string().regex(/^\d\+?$/, { error: "Select the BHK" })) : text(3),
    price: positive("Enter a valid price in ₹"),
    area: positive("Enter a valid area in sq.ft"),
    description: atLeast(2000, 10, "Describe the property (at least 10 characters)"),
    listingType: lowerEnum(["rent", "sale"], 10, "Choose rent or sale"),
    category: lowerEnum(["residential", "commercial"], 20, "Choose residential or commercial"),
    bathrooms: z.preprocess((v) => (given(v) ? num(v) : undefined),
      z.number({ error: "Invalid bathrooms" }).min(0, { error: "Invalid bathrooms" }).max(20, { error: "Invalid bathrooms" }).optional()),
    parking: z.preprocess((v) => (given(v) ? str(v, 30) : undefined), z.string().optional()),
    furnishing: lowerEnum(FURNISHING, 20, "Invalid furnishing"),
    facing: optText(20),
    floor: optText(20),
    totalFloors: z.preprocess((v) => (given(v) ? num(v) : undefined),
      z.number({ error: floorsError }).int({ error: floorsError }).min(1, { error: floorsError }).max(200, { error: floorsError }).optional()),
    possessionStatus: optText(40),
    ageOfProperty: optText(30),
    amenities: tags(120),
    facilities: tags(60), // furnishings and flooring from the amenities step
    buildingGrade: optText(10),
    highlights: tags(12),
    images: z.preprocess(
      (v) => (Array.isArray(v) ? v.map((u) => (typeof u === "string" ? u.trim() : u)).filter(Boolean) : undefined),
      z.array(z.string({ error: IMAGE_ERROR }).refine(isAllowedImageUrl, { error: IMAGE_ERROR }))
        .transform((urls) => [...new Set(urls)].slice(0, 8))
        .optional(),
    ),
    brochure: httpsLink(),
    mapLink: httpsLink(),
    virtualTours: z.preprocess(
      (v) => (Array.isArray(v) ? v.map((u) => (typeof u === "string" ? u.trim() : u)).filter(Boolean) : given(v) ? [v] : undefined),
      z.array(z.string({ error: LINK_ERROR }).refine((u) => isHttpsUrl(u), { error: LINK_ERROR }), { error: LINK_ERROR })
        .max(5, { error: "Add at most 5 virtual tour links" })
        .transform((urls) => [...new Set(urls)])
        .optional(),
    ),
    contactName: optText(80),
    contactPhone: z.preprocess((v) => (v ? cleanPhone(v) : undefined),
      z.string().refine(isValidPhone, { error: "Enter a valid 10-digit contact number" }).optional()),
  });
}

const REQUIRED = ["title", "city", "locality", "propertyType", "bhk", "price", "area", "description"];
const DEVELOPER_SALE_ONLY = "Developers can only list properties for sale";

// -> { d: required fields, opt: optional fields that were sent, errors: { field: message } }.
// `user` is the poster: developers build and sell, so their listings must be for sale.
function parse(body = {}, user = null) {
  const result = listingSchema(body || {}).safeParse(body || {});
  if (!result.success) {
    const { fieldErrors } = z.flattenError(result.error);
    return { d: {}, opt: {}, errors: Object.fromEntries(Object.entries(fieldErrors).map(([k, m]) => [k, m[0]])) };
  }
  const data = result.data;
  if (user?.role === "developer" && data.listingType !== "sale")
    return { d: {}, opt: {}, errors: { listingType: DEVELOPER_SALE_ONLY } };
  const d = Object.fromEntries(REQUIRED.map((k) => [k, data[k]]));
  const opt = Object.fromEntries(Object.entries(data).filter(([k, v]) => !REQUIRED.includes(k) && v !== undefined));
  return { d, opt, errors: {} };
}

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "You've posted a lot of listings in a short time. Please try again later.",
  key: byUser,
});

router.post("/", authRequired, postLimiter, (req, res, next) => { req.postPropertyParsed = parse(req.body, req.user); next(); }, postProperty.postProperty);

module.exports = router;
module.exports.parse = parse;
module.exports.isAllowedImageUrl = isAllowedImageUrl;
