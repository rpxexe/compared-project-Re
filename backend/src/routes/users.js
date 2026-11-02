const express = require("express");
const { authRequired } = require("../middleware/auth");
const User = require("../controllers/users-controller");

const router = express.Router();
router.use(authRequired);

router.get("/me", User.getUser);

router.patch("/me", User.updateUser);

router.get("/me/properties", User.getUserProperties);

// The user's own app-posted listings: read for editing, update (not location / BHK / type), delete.
router.get("/me/properties/:id", User.getOwnProperty);

router.patch("/me/properties/:id", User.updateOwnProperty);

router.delete("/me/properties/:id", User.deleteOwnProperty);

router.get("/me/enquiries", User.getUserEnquiries);

router.get("/me/views", User.getUserViews);

router.delete("/me/views", User.clearUserViews);

module.exports = router;
