const express = require("express");
const { authRequired } = require("../middleware/auth");
const User = require("../controllers/users-controller");

const router = express.Router();
router.use(authRequired);

router.get("/me", User.getUser);

router.patch("/me", User.updateUser);

router.get("/me/properties", User.getUserProperties);

router.get("/me/enquiries", User.getUserEnquiries);

module.exports = router;
