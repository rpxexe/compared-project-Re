const express = require("express");
const { rateLimit } = require("../utils/rateLimit");
const { firebaseToken, firebaseCustomer } = require("../middleware/firebaseAuth");
const Properties = require("../controllers/v2-properties-controller");
const Customer = require("../controllers/v2-customer-controller");
const Leads = require("../controllers/v2-leads-controller");

// Mobile API contract (MOBILE_API.md): property browsing, compare, hearts and contact-form leads.
// Paths, response shapes, limits and error bodies follow the contract exactly, including its
// different 429 bodies per area. Customer routes use Firebase ID tokens, not the v1 JWT.
const router = express.Router();

const perMinute = (max, error) => rateLimit({ windowMs: 60 * 1000, max, body: { error } });
const listingLimiter = perMinute(120, "Too many requests — please slow down.");
const searchLimiter = perMinute(30, "Too many search requests — please slow down.");
const activityLimiter = perMinute(60, "Too many requests — please slow down.");
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  body: { success: false, message: "Too many requests. Please try again later." },
});
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, body: { error: "Too many requests — please slow down." } });

// Properties (public). Static paths before "/:id".
router.get("/properties/filters", Properties.getFilters);
router.get("/properties/localities-by-type", Properties.getLocalitiesByType);
router.get("/properties/localities/:city", Properties.getLocalitiesByCity);
router.get("/properties/location-options", searchLimiter, Properties.getLocationOptions);
router.get("/properties/featured", listingLimiter, Properties.getFeatured);
router.get("/properties/recent", listingLimiter, Properties.getRecent);
router.get("/properties/search", searchLimiter, Properties.searchProperties);
router.get("/properties/related/:id", Properties.getRelated);
router.get("/properties", listingLimiter, Properties.getProperties);
router.get("/properties/:id", Properties.getProperty);

// Customer account (addition to the contract: links a Firebase sign-in to a customer account).
router.post("/customers/register", registerLimiter, firebaseToken, Customer.register);

// Customer activity: one shared limit, then Firebase auth.
router.use("/customerActivity", activityLimiter, firebaseCustomer);
router.get("/customerActivity/my-activity", Customer.getMyActivity);
router.put("/customerActivity/compare", Customer.putCompare);
router.post("/customerActivity/toggle-heart/:propertyId", Customer.toggleHeart);

// Leads (public, as in the contract).
router.post("/leads/customer", leadLimiter, Leads.createCustomerLead);

module.exports = router;
