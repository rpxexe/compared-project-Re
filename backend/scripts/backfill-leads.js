// Creates CRM leads from the enquiries and property views recorded before the CRM existed.
//   npm run backfill:leads              write leads
//   npm run backfill:leads -- --dry-run only count what would be processed
// Safe to run more than once: leads are upserted per (customer, listing) and each enquiry is
// linked and logged only once. No notifications are sent and nothing is auto-assigned.
const env = require('../src/config/env');
const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const { Enquiry, PropertyView, Property, Lead, LeadActivity } = require('../src/models');
const { findAccount } = require('../src/utils/accounts');
const { getSettings } = require('../src/utils/crmSettings');
const { upsertLead, logActivity, refresh } = require('../src/utils/leads');

// Enquiries handled before the CRM: carry their status over to a newly created lead.
const FROM_ENQUIRY = { contacted: { status: 'contacted' }, closed: { status: 'lost', lostReason: 'closed_before_crm' } };

async function customer(id, fallback) {
  const account = (await findAccount(id))?.doc;
  return {
    account,
    user: { id: String(id), name: fallback.name || account?.name || account?.fullName || '', phone: fallback.phone || account?.phone || '' },
  };
}

(async () => {
  if (!env.mongoUri) { console.error('MONGODB_URI is not set in backend/.env'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();
  const settings = await getSettings();
  const noAssign = { ...settings, leads: { ...settings.leads, autoAssign: 'none' } };
  const stats = { views: 0, enquiries: 0, created: 0, skipped: 0 };
  const listings = new Map();
  const listing = async (id) => {
    const key = String(id);
    if (!listings.has(key)) listings.set(key, await Property.findOne({ _id: id }).lean());
    return listings.get(key);
  };

  for await (const v of PropertyView.find({}).lean().cursor()) {
    stats.views += 1;
    const property = await listing(v.property);
    if (!property || dryRun) { if (!property) stats.skipped += 1; continue; }
    const { user, account } = await customer(v.user, v);
    const res = await upsertLead({ user, account, property, source: 'view', set: { viewCount: v.views || 0 } });
    await Lead.updateOne({ _id: res.lead._id }, { $set: { lastActivityAt: v.lastViewedAt || new Date() } });
    if (res.created) {
      stats.created += 1;
      await logActivity(res.lead, 'view', { meta: { views: v.views || 0, backfill: true } });
    }
    await refresh({ ...res.lead, lastActivityAt: v.lastViewedAt }, noAssign);
  }

  for await (const e of Enquiry.find({}).sort({ createdAt: 1 }).lean().cursor()) {
    stats.enquiries += 1;
    const property = await listing(e.property);
    if (!property || dryRun) { if (!property) stats.skipped += 1; continue; }
    const { user, account } = await customer(e.user, e);
    const res = await upsertLead({ user, account, property, source: 'enquiry', set: { priority: 'hot' }, addEnquiry: e._id });
    let { lead } = res;
    if (res.created) {
      stats.created += 1;
      const carry = FROM_ENQUIRY[e.status];
      if (carry) {
        await Lead.updateOne({ _id: lead._id }, { $set: carry });
        lead = { ...lead, ...carry };
      }
    }
    await Lead.updateOne({ _id: lead._id }, { $set: { lastActivityAt: e.createdAt || new Date() } });
    const logged = await LeadActivity.findOne({ lead: lead._id, type: 'enquiry', 'meta.enquiryId': String(e._id) }).lean();
    if (!logged) await logActivity(lead, 'enquiry', { body: e.message || '', meta: { enquiryId: String(e._id), backfill: true } });
    await refresh({ ...lead, lastActivityAt: e.createdAt }, noAssign);
  }

  console.log(`${dryRun ? '[dry run] ' : ''}Scanned ${stats.views} views and ${stats.enquiries} enquiries; `
    + `${dryRun ? '' : `created ${stats.created} leads; `}${stats.skipped} skipped (listing no longer exists).`);
  await mongoose.disconnect();
})().catch((e) => { console.error('Backfill failed:', e.message); process.exit(1); });
