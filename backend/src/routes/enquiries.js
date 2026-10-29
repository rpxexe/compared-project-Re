const express = require("express");
const Enquiry = require("../controllers/enquiries-controller");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.post("/", authRequired, Enquiry.postEnquiry);

module.exports = router;
