const express = require("express");
const { authRequired } = require("../middleware/auth");
const User = require("../controllers/users-controller");
const { rateLimit, byUser } = require("../utils/rateLimit");

const router = express.Router();
router.use(authRequired);
const editLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "Too many changes in a short time. Please try again later.",
  key: byUser,
});

router.get("/me", User.getUser);

router.patch("/me", User.updateUser);

router.get("/me/properties", User.getUserProperties);

// The user's own app-posted listings: read for editing, update (not location / BHK / type), delete.
router.get("/me/properties/:id", User.getOwnProperty);

router.patch("/me/properties/:id", editLimiter, User.updateOwnProperty);

router.delete("/me/properties/:id", User.deleteOwnProperty);

router.get("/me/enquiries", User.getUserEnquiries);

module.exports = router;
