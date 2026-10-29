const express = require("express");
const Property = require("../controllers/properties-controller");
const { authRequired, authOptional } = require("../middleware/auth");

const router = express.Router();

// GET /api/properties – search / filter / sort / paginate. Everything is done in MongoDB.
router.get("/", Property.getProperties);

// GET /api/properties/categories – which "New Project" categories actually have data.
router.get("/categories", Property.getPropertyCategories);

// Filter option lists used by the app's filter sheet (values that really exist in the data).
router.get("/facets", Property.getFacets);

router.get("/locations", Property.getLocations);

router.get("/top-rated", Property.getTopRatedProperties);

router.get("/compare", Property.getCompareProperties);

router.get("/saved/list", authRequired, Property.getSavedProperties);

router.get("/:id", authOptional, Property.getProperty);

// Body {saved:true|false} makes the call idempotent; with no body it toggles.
router.post("/:id/save", authRequired, Property.saveProperty);

router.delete("/:id/save", authRequired, Property.deleteSavedProperty);

router.get("/:id/reviews", authOptional, Property.getReviews);

router.post("/:id/reviews", authRequired, Property.postReview);

router.delete("/:id/reviews/mine", authRequired, Property.deleteReview);

module.exports = router;
