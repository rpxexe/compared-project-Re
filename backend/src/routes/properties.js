const express = require("express");
const Property = require("../controllers/properties-controller");
const { authRequired, authOptional } = require("../middleware/auth");
const { rateLimit, byUser } = require("../utils/rateLimit");

const router = express.Router();

// Per client IP; generous enough for normal browsing and the live "Show N results" counter.
const perMinute = (max, message) => rateLimit({ windowMs: 60 * 1000, max, message });
const searchLimiter = perMinute(120, "Too many searches. Please slow down.");
const countLimiter = perMinute(240, "Too many requests. Please slow down.");
const insightsLimiter = perMinute(30, "Too many requests. Please slow down.");
// Per signed-in user.
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many reviews. Please try again later.",
  key: byUser,
});

// GET /api/properties – search / filter / sort / paginate. Everything is done in MongoDB.
router.get("/", searchLimiter, Property.getProperties);

// GET /api/properties/count – total for the same filters (live "Show N results").
router.get("/count", countLimiter, Property.getPropertyCount);

// GET /api/properties/categories – which "New Project" categories actually have data.
router.get("/categories", Property.getPropertyCategories);

// Filter option lists used by the app's filter sheet (values that really exist in the data).
router.get("/facets", Property.getFacets);

router.get("/locations", Property.getLocations);

// Must stay above "/:id".
router.get("/insights", insightsLimiter, Property.getInsights);

router.get("/top-rated", Property.getTopRatedProperties);

router.get("/compare", Property.getCompareProperties);

router.get("/by-ids", Property.getPropertiesByIds);

router.get("/saved/list", authRequired, Property.getSavedProperties);

router.get("/:id", authOptional, Property.getProperty);

// Body {saved:true|false} makes the call idempotent; with no body it toggles.
router.post("/:id/save", authRequired, Property.saveProperty);

router.delete("/:id/save", authRequired, Property.deleteSavedProperty);

router.get("/:id/reviews", authOptional, Property.getReviews);

router.post("/:id/reviews", authRequired, reviewLimiter, Property.postReview);

router.delete("/:id/reviews/mine", authRequired, Property.deleteReview);

module.exports = router;
