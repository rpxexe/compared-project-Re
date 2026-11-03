// Notifies the assignee once when a lead's follow-up time arrives.
const env = require("../config/env");
const { Lead } = require("../models");
const { notify } = require("./notify");
const { CLOSED } = require("./leads");

async function sendDueReminders(now = new Date()) {
  const due = await Lead.find({
    nextFollowUpAt: { $lte: now },
    assignedTo: { $ne: null },
    status: { $nin: CLOSED },
  }).limit(500).lean();
  let sent = 0;
  for (const lead of due) {
    const at = new Date(lead.nextFollowUpAt).getTime();
    if (lead.followUpNotifiedFor && new Date(lead.followUpNotifiedFor).getTime() === at) continue;
    await notify(lead.assignedTo, {
      type: "lead", title: "Follow-up due",
      message: `${lead.name || lead.phone} – ${lead.propertyTitle || "lead"}`, data: { leadId: String(lead._id) },
    });
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpNotifiedFor: lead.nextFollowUpAt } });
    sent += 1;
  }
  return sent;
}

function startFollowUpReminders(minutes = 15) {
  if (!(minutes > 0)) return null;
  const run = () => sendDueReminders().catch((e) => { if (!env.isTest) console.error("follow-up reminders failed:", e.message); });
  const timer = setInterval(run, minutes * 60000);
  timer.unref();
  return timer;
}

module.exports = { sendDueReminders, startFollowUpReminders };
