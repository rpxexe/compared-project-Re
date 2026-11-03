const { bad } = require("./errors");
const { str } = require("./validate");

// The CRM's "today" is the India calendar day (UTC+05:30), whatever the server's timezone.
const IST_MS = 330 * 60000;
const DAY_MS = 86400000;

function istDayStart(d = new Date()) {
  const t = d.getTime() + IST_MS;
  return new Date(t - (((t % DAY_MS) + DAY_MS) % DAY_MS) - IST_MS);
}
const istDayEnd = (d = new Date()) => new Date(istDayStart(d).getTime() + DAY_MS - 1);

// Chart bucket for a date: "2026-11-03" (day), the Monday of its week (week) or "2026-11" (month).
function bucketKey(d, interval) {
  const local = new Date(new Date(d).getTime() + IST_MS);
  if (interval === "month") return local.toISOString().slice(0, 7);
  if (interval === "week") local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

// Optional date input: undefined when absent, null when explicitly cleared, otherwise a Date.
function optDate(v, label) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(str(v, 40));
  if (Number.isNaN(d.getTime())) throw bad(`${label} must be a valid date`);
  return d;
}

module.exports = { istDayStart, istDayEnd, bucketKey, optDate, DAY_MS };
