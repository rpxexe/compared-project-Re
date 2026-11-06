// Creates a developer (email + password) account. Developers can no longer sign themselves up;
// an administrator runs this and hands the printed password to the developer over a safe channel.
//
//   npm run create:developer -- --email sales@builder.com --name "Skyline Builders" [--phone 9876543210]
//
// The password is generated here, stored only as a scrypt hash and printed exactly once.
const { z, validate, email, phone } = require("../src/utils/zod");
const { str } = require("../src/utils/validate");
const { hashPassword, generatePassword } = require("../src/utils/password");

const developerSchema = z.object({
  email: email(),
  name: z.preprocess((v) => str(v, 61), z.string()
    .min(2, { error: "Name must be 2-60 characters" })
    .max(60, { error: "Name must be 2-60 characters" })),
  phone: z.preprocess((v) => (v === undefined || v === "" ? undefined : v),
    phone("Phone must be a valid 10-digit Indian mobile number").optional()),
});

class CliError extends Error {}

// --email a@b.com --name "X Y" --phone 98...  (also --email=a@b.com)
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--(email|name|phone)(?:=(.*))?$/.exec(argv[i]);
    if (!m) throw new CliError(`Unknown argument: ${argv[i]}`);
    const value = m[2] !== undefined ? m[2] : argv[i + 1];
    if (m[2] === undefined) i += 1;
    if (value === undefined || value.startsWith("--")) throw new CliError(`--${m[1]} needs a value`);
    out[m[1]] = value;
  }
  return out;
}

// -> { user, password }. Throws CliError for invalid input or an existing account.
async function createDeveloper(input, { SignUpUser = require("../src/models").SignUpUser } = {}) {
  let data;
  try {
    data = validate(developerSchema, input, "Invalid developer details");
  } catch (e) {
    const details = e.extra?.errors ? Object.values(e.extra.errors).join("; ") : e.message;
    throw new CliError(details);
  }
  if (await SignUpUser.findOne({ email: data.email }).lean())
    throw new CliError(`An account with the email ${data.email} already exists. Nothing was changed.`);

  const password = generatePassword();
  let user;
  try {
    user = await SignUpUser.create({
      fullName: data.name,
      email: data.email,
      phone: data.phone || "",
      password: await hashPassword(password),
      role: "developer",
      isActive: true,
      tokenVersion: 0,
    });
  } catch (e) {
    // Lost a race with another create for the same email (unique index).
    if (e?.code === 11000) throw new CliError(`An account with the email ${data.email} already exists. Nothing was changed.`);
    throw e;
  }
  return { user, password };
}

async function main() {
  const mongoose = require("mongoose");
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    if (!args.email || !args.name) throw new CliError("Usage: npm run create:developer -- --email <email> --name <name> [--phone <10-digit mobile>]");
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const env = require("../src/config/env");
  if (!env.mongoUri || /PASTE_YOUR|<password>|<user>/.test(env.mongoUri)) {
    console.error("MONGODB_URI is missing. Set it in backend/.env first.");
    process.exit(1);
  }
  const { connectDb } = require("../src/config/db");
  try {
    await connectDb();
    const { user, password } = await createDeveloper(args);
    console.log("Developer account created.");
    console.log(`  Name:     ${user.fullName}`);
    console.log(`  Email:    ${user.email}`);
    if (user.phone) console.log(`  Phone:    ${user.phone}`);
    console.log(`  Password: ${password}`);
    console.log("This password is shown only once and is not stored anywhere in plain text.");
    console.log("Share it with the developer over a secure channel.");
    process.exitCode = 0;
  } catch (e) {
    console.error(e instanceof CliError ? e.message : `Could not create the developer account: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { createDeveloper, parseArgs, CliError };
