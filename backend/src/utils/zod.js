// Request validation with zod, in the API's existing error format: a 400 whose message is the
// field's own message when one field is wrong (otherwise `summary`), plus errors as
// { field: message }, which is what the app reads.
const { z } = require("zod");
const { bad } = require("./errors");
const { str, cleanPhone, isValidPhone, isObjectId, isPropertyId } = require("./validate");

function firstErrors(error) {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return { formErrors, errors: Object.fromEntries(Object.entries(fieldErrors).map(([k, m]) => [k, m[0]])) };
}

function validate(schema, data, summary = "Please fix the highlighted fields") {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const { formErrors, errors } = firstErrors(result.error);
  const keys = Object.keys(errors);
  if (!keys.length) throw bad(formErrors[0] || "Invalid request body");
  throw bad(keys.length === 1 ? errors[keys[0]] : summary, { errors });
}

// Shared field schemas.
const text = (max) => z.preprocess((v) => (v === undefined ? undefined : str(v, max)), z.string());
const phone = (error) => z.preprocess((v) => cleanPhone(v), z.string().refine(isValidPhone, { error }));
const objectId = (error) => z.string({ error }).refine(isObjectId, { error });
const propertyId = (error = "Invalid property id") => z.string({ error }).refine(isPropertyId, { error });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254; // RFC 5321 path limit
// Oversized input becomes null before the regex ever sees it: a huge "email" is rejected in O(1)
// instead of being fed to a backtracking regex - or silently cut down to 254 characters and
// accepted as a different address.
const email = (error = "Enter a valid email address") =>
  z.preprocess((v) => {
    if (typeof v !== "string") return "";
    const s = v.trim();
    return s.length > EMAIL_MAX ? null : s.toLowerCase();
  }, z.string({ error }).regex(EMAIL, { error }));
// Absolute https:// URL (no credentials) - for links the app opens and images it loads.
const isHttpsUrl = (v, max = 2048) => {
  if (typeof v !== "string" || !v || v.length > max || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
};
// A date, or null to clear it (accepts anything `new Date()` reads).
const date = (label) => z.union([
  z.null(),
  z.literal("").transform(() => null),
  z.coerce.date({ error: `${label} must be a valid date` }),
], { error: `${label} must be a valid date` });
const money = (label) => z.union([z.null(), z.literal("").transform(() => null), z.coerce.number({ error: `${label} must be a positive number` }).min(0, { error: `${label} must be a positive number` })]);
const oneOf = (values, label) => z.enum(values, { error: `${label} must be one of: ${values.join(", ")}` });

module.exports = { z, validate, firstErrors, text, phone, objectId, propertyId, email, date, money, oneOf, EMAIL, EMAIL_MAX, isHttpsUrl };
