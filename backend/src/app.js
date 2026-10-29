const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/error");
const mongoose = require("mongoose");
const helmet = require("helmet");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // Security headers must be registered before the routes; middleware added after the
  // routes/error handler never runs for API responses. This is a JSON API, so no CSP.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
    }),
  );
  // Native mobile apps send no Origin header, so CORS only matters for web/admin front-ends.
  app.use(cors(env.corsOrigins.length ? { origin: env.corsOrigins } : {}));
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus =
      dbState === 1
        ? "connected"
        : dbState === 2
        ? "connecting"
        : "disconnected";
    return res.json({
      ok: true,
      service: "compare-project-backend",
      database: dbStatus,
      databaseState: dbState,
      time: new Date().toISOString(),
    });
  });
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/properties", require("./routes/properties"));
  app.use("/api/post-property", require("./routes/postProperty"));
  app.use("/api/enquiries", require("./routes/enquiries"));
  app.use("/api/notifications", require("./routes/notifications"));
  app.use("/api/admin", require("./routes/admin"));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
