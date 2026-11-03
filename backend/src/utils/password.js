const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = stored.split(":");
  const expected = Buffer.from(expectedHex || "", "hex");
  const actual = await scrypt(password, salt, 64);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
// Valid-format hash of a random throwaway password, compared against for unknown emails.
const DUMMY_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

const validPassword = (p) => typeof p === "string" && p.length >= 8 && p.length <= 128;

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, validPassword };
