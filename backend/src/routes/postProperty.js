const express = require("express");
const { authRequired } = require("../middleware/auth");
const postProperty = require("../controllers/postProperty-controller");
const { str, cleanPhone, isValidPhone } = require("../utils/validate");

const router = express.Router();
const FURNISHING = ["unfurnished", "semi-furnished", "furnished"];
// Property types where "BHK" does not apply (kept in sync with the app's validators).
const NO_BHK = /plot|land|commercial|shop|showroom|office|warehouse|industrial|co-?working/i;

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function parse(body = {}) {
  const errors = {};
  const d = {
    title: str(body.title, 120),
    city: str(body.city, 60),
    locality: str(body.locality, 80),
    propertyType: str(body.propertyType, 60),
    bhk: str(body.bhk, 3),
    price: num(body.price),
    area: num(body.area),
    description: str(body.description, 2000),
  };
  if (d.title.length < 3)
    errors.title = "Enter a property title (at least 3 characters)";
  if (!d.city) errors.city = "City is required";
  if (!d.locality) errors.locality = "Locality is required";
  if (!d.propertyType) errors.propertyType = "Select a property type";
  const isCommercial = str(body.category, 20).toLowerCase() === "commercial";
  if (!isCommercial && !NO_BHK.test(d.propertyType) && !/^\d\+?$/.test(d.bhk))
    errors.bhk = "Select the BHK";
  if (!(d.price > 0)) errors.price = "Enter a valid price in ₹";
  if (!(d.area > 0)) errors.area = "Enter a valid area in sq.ft";
  if (d.description.length < 10)
    errors.description = "Describe the property (at least 10 characters)";

  const opt = {};
  const listingType = str(body.listingType, 10).toLowerCase();
  const category = str(body.category, 20).toLowerCase();
  if (listingType && !["rent", "sale"].includes(listingType)) errors.listingType = "Choose rent or sale";
  if (category && !["residential", "commercial"].includes(category)) errors.category = "Choose residential or commercial";
  if (listingType) opt.listingType = listingType;
  if (category) opt.category = category;
  if (body.bathrooms !== undefined && body.bathrooms !== "") {
    const n = num(body.bathrooms);
    if (!(n >= 0 && n <= 20)) errors.bathrooms = "Invalid bathrooms";
    else opt.bathrooms = n;
  }
  if (body.parking !== undefined && body.parking !== "")
    opt.parking = str(body.parking, 30);
  if (body.furnishing) {
    const f = str(body.furnishing, 20).toLowerCase();
    if (!FURNISHING.includes(f)) errors.furnishing = "Invalid furnishing";
    else opt.furnishing = f;
  }
  if (body.facing) opt.facing = str(body.facing, 20);
  if (body.floor) opt.floor = str(body.floor, 20);
  if (body.totalFloors !== undefined && body.totalFloors !== "") {
    const n = num(body.totalFloors);
    if (!(Number.isInteger(n) && n >= 1 && n <= 200)) errors.totalFloors = "Enter total floors between 1 and 200";
    else opt.totalFloors = n;
  }
  if (body.possessionStatus)
    opt.possessionStatus = str(body.possessionStatus, 40);
  if (body.ageOfProperty) opt.ageOfProperty = str(body.ageOfProperty, 30);
  if (Array.isArray(body.amenities))
    opt.amenities = [
      ...new Set(body.amenities.map((a) => str(a, 40)).filter(Boolean)),
    ].slice(0, 120);
  // Furnishings and flooring from the amenities step.
  if (Array.isArray(body.facilities))
    opt.facilities = [
      ...new Set(body.facilities.map((a) => str(a, 40)).filter(Boolean)),
    ].slice(0, 60);
  if (body.buildingGrade) opt.buildingGrade = str(body.buildingGrade, 10);
  if (Array.isArray(body.highlights))
    opt.highlights = [
      ...new Set(body.highlights.map((h) => str(h, 40)).filter(Boolean)),
    ].slice(0, 12);
  if (Array.isArray(body.images)) {
    const urls = body.images.map((u) => str(u, 500)).filter(Boolean);
    if (urls.some((u) => !/^https?:\/\/\S+$/i.test(u)))
      errors.images = "Image links must start with http:// or https://";
    else opt.images = [...new Set(urls)].slice(0, 8);
  }
  if (body.contactName) opt.contactName = str(body.contactName, 80);
  if (body.contactPhone) {
    const p = cleanPhone(body.contactPhone);
    if (!isValidPhone(p))
      errors.contactPhone = "Enter a valid 10-digit contact number";
    else opt.contactPhone = p;
  }
  return { d, opt, errors };
}

router.post("/", authRequired, (req, res, next) => { req.postPropertyParsed = parse(req.body); next(); }, postProperty.postProperty);

module.exports = router;
module.exports.parse = parse;
