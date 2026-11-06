const express = require("express");
const Enquiry = require("../controllers/enquiries-controller");
const { authRequired } = require("../middleware/auth");
const { rateLimit, byUser } = require("../utils/rateLimit");

const router = express.Router();
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many enquiries. Please try again later.",
  key: byUser,
});

router.post("/", authRequired, enquiryLimiter, Enquiry.postEnquiry);

module.exports = router;
