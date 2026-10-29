const express = require("express");
const { authRequired } = require("../middleware/auth");
const Notifications = require("../controllers/notifications-controller");

const router = express.Router();
router.use(authRequired);
router.get("/", Notifications.list);
router.post("/add", Notifications.create);
router.patch("/read-all", Notifications.markAllRead);
router.patch("/:id/read", Notifications.markRead);
module.exports = router;
