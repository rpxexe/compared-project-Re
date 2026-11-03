const express = require("express");
const { authRequired, requireRole } = require("../middleware/auth");
const { rateLimit } = require("../utils/rateLimit");
const Dashboard = require("../controllers/crm-dashboard-controller");
const Leads = require("../controllers/crm-leads-controller");
const Properties = require("../controllers/crm-properties-controller");
const Users = require("../controllers/crm-users-controller");

// REST API for the CRM (see CRM_API.md). Every route verifies the JWT and the staff role on
// the server; the role is read from MongoDB on each request, so demotions apply immediately.
const router = express.Router();
const perUser = (prefix) => (req) => (req.user ? `${prefix}:${req.user.id}` : null);
router.use(
  authRequired,
  requireRole("admin", "superadmin"),
  rateLimit({ windowMs: 60 * 1000, max: 300, message: "Too many requests. Please slow down.", key: perUser("crm") }),
);
const superOnly = requireRole("superadmin");
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Export limit reached. Please try again in an hour.",
  key: perUser("crm-export"),
});

// Me
router.get("/me", Users.getMe);
router.post("/me/password", Users.changeMyPassword);

// Dashboard
router.get("/stats", Dashboard.getStats);
router.get("/stats/trends", Dashboard.getTrends);
router.get("/stats/staff-performance", superOnly, Dashboard.getStaffPerformance);

// Leads (static paths before "/leads/:id")
router.get("/leads", Leads.getLeads);
router.post("/leads", Leads.createLead);
router.get("/leads/export", superOnly, exportLimiter, Leads.exportLeads);
router.post("/leads/bulk", Leads.bulkLeads);
router.get("/leads/:id", Leads.getLead);
router.patch("/leads/:id", Leads.updateLead);
router.delete("/leads/:id", superOnly, Leads.deleteLead);
router.post("/leads/:id/assign", Leads.assignLead);
router.get("/leads/:id/activities", Leads.getActivities);
router.post("/leads/:id/activities", Leads.addActivity);
router.patch("/leads/:id/activities/:activityId", Leads.updateActivity);
router.delete("/leads/:id/activities/:activityId", Leads.deleteActivity);
router.get("/follow-ups", Leads.getFollowUps);

// Raw lead sources
router.get("/enquiries", Leads.getEnquiries);
router.patch("/enquiries/:id", Leads.updateEnquiry);
router.get("/views", Leads.getViews);

// Properties
router.get("/properties", Properties.getProperties);
router.post("/properties", Properties.createProperty);
router.post("/properties/bulk", Properties.bulkProperties);
router.get("/properties/:id", Properties.getProperty);
router.patch("/properties/:id", Properties.updateProperty);
router.delete("/properties/:id", superOnly, Properties.deleteProperty);
router.get("/properties/:id/leads", Properties.getPropertyLeads);
router.delete("/reviews/:id", Leads.deleteReview);

// Customers
router.get("/users", Users.getUsers);
router.get("/users/:id", Users.getUser);
router.patch("/users/:id", superOnly, Users.updateUser);
router.get("/users/:id/leads", Users.getUserLeads);
router.get("/users/:id/properties", Users.getUserProperties);
router.post("/users/:id/notify", Users.notifyUser);

// Staff (admins may read the short list for "assign to")
router.get("/staff", Users.getStaff);
router.post("/staff", superOnly, Users.createStaff);
router.patch("/staff/:id", superOnly, Users.updateStaff);
router.post("/staff/:id/reset-password", superOnly, Users.resetStaffPassword);
router.delete("/staff/:id", superOnly, Users.deactivateStaff);

// System
router.get("/audit-log", superOnly, Dashboard.getAuditLog);
router.get("/settings", Dashboard.getCrmSettings);
router.patch("/settings", superOnly, Dashboard.updateCrmSettings);

module.exports = router;
