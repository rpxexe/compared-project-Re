const env = require("../config/env");
const { CrmSetting } = require("../models");
const { bad } = require("./errors");
const { str } = require("./validate");
const { z, validate } = require("./zod");

const KEY = "global";
const AUTO_ASSIGN = ["none", "least_loaded"];
const WEIGHTS = ["enquiry", "view", "saved", "purpose", "recent"];

// Defaults are computed on every read so AUTO_APPROVE_POSTS in .env stays the fallback.
const defaults = () => ({
  autoApprovePosts: env.autoApprovePosts,
  leads: {
    viewThreshold: 1,
    autoAssign: "none",
    scoreWeights: { enquiry: 40, view: 3, saved: 10, purpose: 10, recent: 10 },
    lostReasons: ["not_interested", "budget", "bought_elsewhere", "unreachable", "listing_removed"],
  },
  followUps: { defaultHours: 24 },
});

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

async function getSettings() {
  const doc = await CrmSetting.findOne({ key: KEY }).lean();
  return merge(defaults(), doc?.value);
}

const whole = (min, max, label) => {
  const error = `${label} must be a whole number from ${min} to ${max}`;
  return z.coerce.number({ error }).int({ error }).min(min, { error }).max(max, { error });
};

// A partial settings patch; anything not listed is dropped.
const patchSchema = z.object({
  autoApprovePosts: z.boolean({ error: "autoApprovePosts must be true or false" }).optional(),
  leads: z.object({
    viewThreshold: whole(1, 100, "leads.viewThreshold").optional(),
    autoAssign: z.enum(AUTO_ASSIGN, { error: `leads.autoAssign must be one of: ${AUTO_ASSIGN.join(", ")}` }).optional(),
    scoreWeights: z.object(Object.fromEntries(WEIGHTS.map((k) => [k, whole(0, 100, `leads.scoreWeights.${k}`).optional()]))).optional(),
    lostReasons: z.array(z.any(), { error: "leads.lostReasons must be a list" })
      .transform((list) => [...new Set(list.map((r) => str(r, 40)).filter(Boolean))].slice(0, 20)).optional(),
  }).optional(),
  followUps: z.object({ defaultHours: whole(1, 720, "followUps.defaultHours").optional() }).optional(),
});

// Validated patch without the keys that weren't sent.
function cleanPatch(body) {
  const strip = (o) => (isObj(o)
    ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, strip(v)]))
    : o);
  const out = strip(validate(patchSchema, body));
  if (!Object.keys(out).length) throw bad("Nothing to update");
  return out;
}

async function saveSettings(patch) {
  const doc = await CrmSetting.findOne({ key: KEY }).lean();
  const value = merge(doc?.value || {}, cleanPatch(patch));
  await CrmSetting.findOneAndUpdate({ key: KEY }, { $set: { value } }, { upsert: true, new: true });
  return merge(defaults(), value);
}

module.exports = { getSettings, saveSettings };
