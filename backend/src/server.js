const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]); // Uses Cloudflare and Google DNS

const mongoose = require("mongoose");
const env = require("./config/env");
const { connectDb } = require("./config/db");
const { createApp } = require("./app");
const { startFilterSync } = require("./utils/filterSync");

async function start() {
  const problems = env.validate();
  if (problems.length) {
    problems.forEach((p) => console.error(`Config error: ${p}`));
    process.exit(1);
  }
  await connectDb();
  console.log("MongoDB connected");
  startFilterSync(env.filterSyncMinutes);
  const firebase = require("./utils/firebase");
  if (!firebase.isConfigured())
    console.warn("WARNING: FIREBASE_PROJECT_ID is not set, so /api/v2 customer routes reject every token (401 Invalid token).");
  else if (!env.firebase.serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS)
    console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT is not set. Firebase token revocation checks need admin credentials; without them /api/v2 customer routes reject every token.");
  if (env.devOtpEnabled()) {
    console.warn(
      "WARNING: OTP_MODE=development returns login codes in API responses. Anyone who can reach " +
        "this server can sign in as any phone number. Never expose it publicly; use OTP_MODE=twilio.",
    );
  }
  const server = createApp().listen(env.port, "0.0.0.0", () =>
    console.log(`API listening on port ${env.port} (OTP mode: ${env.otpMode})`),
  );

  // Graceful shutdown for restarts/deploys: stop accepting connections, let in-flight
  // requests finish, then close the DB pool. Forced exit if it takes too long.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
