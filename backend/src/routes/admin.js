const express = require("express");
const Admin = require("../controllers/admin-controller");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();
// Every admin endpoint verifies the JWT AND the role on the server.
router.use(authRequired, requireRole("admin", "superadmin"));
const superOnly = requireRole("superadmin");

router.get("/stats", Admin.getStats);

router.get("/users", Admin.getUsers);

router.patch("/users/:id", superOnly, Admin.updateUser);

router.get("/properties", Admin.getProperties);

router.patch("/properties/:id", Admin.updateProperty);

// Only submissions created through the app can be deleted; imported source data is protected.
router.delete("/properties/:id", superOnly, Admin.deleteProperty);

router.get("/enquiries", Admin.getEnquiries);

router.patch("/enquiries/:id", Admin.updateEnquiry);

// Review moderation is an admin task (README: "admins can remove abusive reviews").
router.delete("/reviews/:id", Admin.deleteReview);

 
module.exports = router;
