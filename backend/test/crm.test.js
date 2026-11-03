const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const { sendDueReminders } = require('../src/utils/followUpReminders');
const seed = require('./seed');

let t; let user; let user2; let admin; let superadmin; let propertyId; let pendingId; let manualOwnedId;
const publicIds = () => models.Property._rows.filter((p) => !p.approvalStatus || p.approvalStatus === 'approved').map((p) => String(p._id));

test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  user = await t.login('9811111111');
  await t.call('PATCH', '/users/me', { token: user.token, body: { name: 'Riya Buyer', purpose: 'buyer', city: 'Pune' } });
  user2 = await t.login('9822222222');
  admin = await t.login('9000000001');
  superadmin = await t.login('9000000002');
  [propertyId] = publicIds();
  pendingId = String(models.Property._rows.find((p) => p.approvalStatus === 'pending')._id);
  const posted = await t.call('POST', '/post-property', {
    token: user2.token,
    body: { title: 'Owner Flat', city: 'Pune', locality: 'Wakad', propertyType: 'Flats/Apartments', bhk: '2', price: 7000000, area: 900, description: 'Nice flat near the park' },
  });
  manualOwnedId = posted.body.property.id;
});
test.after(() => t.close());

const ROUTES = [
  ['GET', '/crm/me'], ['GET', '/crm/stats'], ['GET', '/crm/leads'], ['GET', '/crm/follow-ups'], ['GET', '/crm/properties'],
  ['GET', '/crm/users'], ['GET', '/crm/staff'], ['GET', '/crm/enquiries'], ['GET', '/crm/views'], ['GET', '/crm/settings'],
];
const SUPER_ROUTES = [
  ['GET', '/crm/leads/export'], ['GET', '/crm/audit-log'], ['GET', '/crm/stats/staff-performance'],
  ['PATCH', '/crm/settings', { autoApprovePosts: true }], ['POST', '/crm/staff', {}],
];

test('role matrix: anonymous 401, customers 403, admins blocked from super-admin routes', async () => {
  for (const [m, p] of ROUTES) {
    assert.equal((await t.call(m, p)).status, 401, `${p} anon`);
    assert.equal((await t.call(m, p, { token: user.token })).status, 403, `${p} user`);
    assert.equal((await t.call(m, p, { token: 'x.y.z' })).status, 401, `${p} bad token`);
    assert.equal((await t.call(m, p, { token: admin.token })).status, 200, `${p} admin`);
  }
  for (const [m, p, body] of SUPER_ROUTES) assert.equal((await t.call(m, p, { token: admin.token, body })).status, 403, `${p} admin`);
  assert.equal((await t.call('GET', '/admin/stats', { token: superadmin.token })).status, 404, 'old /api/admin is gone');
});

test('me: profile and permissions per role', async () => {
  const a = await t.call('GET', '/crm/me', { token: admin.token });
  assert.equal(a.body.user.role, 'admin');
  assert.ok(a.body.permissions.includes('leads:assign:self'));
  assert.ok(!a.body.permissions.includes('staff:manage'));
  const s = await t.call('GET', '/crm/me', { token: superadmin.token });
  assert.ok(s.body.permissions.includes('staff:manage'));
  assert.equal((await t.call('POST', '/crm/me/password', { token: admin.token, body: { currentPassword: 'x', newPassword: 'y' } })).status, 400, 'OTP accounts have no password');
});

test('leads are created from views, enquiries and saves, one per customer and listing', async () => {
  await t.call('POST', `/properties/${propertyId}/view`, { token: user.token });
  await t.call('POST', `/properties/${propertyId}/view`, { token: user.token });
  let rows = models.Lead._rows.filter((l) => String(l.property) === propertyId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].viewCount, 2);
  assert.deepEqual(rows[0].sources, ['view']);

  await t.call('POST', '/enquiries', { token: user.token, body: { propertyId, message: 'Is it available?' } });
  await t.call('POST', `/properties/${propertyId}/save`, { token: user.token, body: { saved: true } });
  rows = models.Lead._rows.filter((l) => String(l.property) === propertyId);
  assert.equal(rows.length, 1);
  assert.deepEqual([...rows[0].sources].sort(), ['enquiry', 'saved', 'view']);
  assert.equal(rows[0].priority, 'hot');
  assert.equal(rows[0].enquiryIds.length, 1);
  assert.equal(rows[0].name, 'Riya Buyer');
  assert.equal(rows[0].score, 40 + 2 * 3 + 10 + 10 + 10);

  const n = models.Notification._rows.filter((x) => String(x.user) === superadmin.user.id && x.type === 'lead');
  assert.equal(n.length, 1, 'unassigned enquiry notifies super admins');
});

test('leads: list filters, detail, patch with status sync to enquiries', async () => {
  const list = await t.call('GET', '/crm/leads?source=enquiry&status=new', { token: admin.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);
  const lead = list.body.items[0];
  assert.equal(lead.property.id, propertyId);
  assert.equal(lead.enquiryCount, 1);
  assert.equal((await t.call('GET', '/crm/leads?search=Riya', { token: admin.token })).body.total, 1);
  assert.equal((await t.call('GET', '/crm/leads?assignedTo=unassigned', { token: admin.token })).body.total >= 1, true);
  assert.equal((await t.call('GET', '/crm/leads?assignedTo=nope', { token: admin.token })).status, 400);

  const detail = await t.call('GET', `/crm/leads/${lead.id}`, { token: admin.token });
  assert.equal(detail.body.customer.phone, '9811111111');
  assert.equal(detail.body.enquiries[0].message, 'Is it available?');
  assert.ok(detail.body.recentActivities.some((a) => a.type === 'enquiry'));
  assert.equal((await t.call('GET', `/crm/leads/${t.oid()}`, { token: admin.token })).status, 404);

  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { status: 'lost' } })).status, 400, 'lost needs a reason');
  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { status: 'banana' } })).status, 400);
  const up = await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { status: 'qualified', budgetMin: 9000000, budgetMax: 13000000, tags: ['VIP'] } });
  assert.equal(up.status, 200);
  assert.equal(up.body.lead.status, 'qualified');
  assert.deepEqual(up.body.lead.tags, ['vip']);
  assert.equal(models.Enquiry._rows[0].status, 'contacted', 'enquiry status follows the lead');
  await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { status: 'lost', lostReason: 'budget' } });
  assert.equal(models.Enquiry._rows[0].status, 'closed');
  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { budgetMin: 5, budgetMax: 1 } })).status, 400);

  // A fresh enquiry reopens a lost lead.
  await t.call('POST', '/enquiries', { token: user.token, body: { propertyId, message: 'Still interested' } });
  const reopened = await t.call('GET', `/crm/leads/${lead.id}`, { token: admin.token });
  assert.equal(reopened.body.lead.status, 'new');
  assert.equal(reopened.body.lead.enquiryCount, 2);
});

test('assignment: admins take or release their own, super admins assign anyone', async () => {
  const lead = (await t.call('GET', '/crm/leads?search=Riya', { token: admin.token })).body.items[0];
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: admin.token, body: { assignedTo: superadmin.user.id } })).status, 403);
  const mine = await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: admin.token, body: { assignedTo: 'me' } });
  assert.equal(mine.body.lead.assignedTo.id, admin.user.id);
  assert.equal((await t.call('GET', '/crm/leads?assignedTo=me', { token: admin.token })).body.total, 1);
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: superadmin.token, body: { assignedTo: user.user.id } })).status, 400, 'customers are not staff');
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: superadmin.token, body: { assignedTo: superadmin.user.id } })).status, 200);
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: admin.token, body: { assignedTo: null } })).status, 403, "can't release someone else's lead");
  await t.call('POST', `/crm/leads/${lead.id}/assign`, { token: superadmin.token, body: { assignedTo: admin.user.id } });
  assert.ok(models.Notification._rows.some((n) => String(n.user) === admin.user.id && n.title === 'Lead assigned to you'));
});

test('activities: outreach moves new leads to contacted; only authors edit; system entries are locked', async () => {
  const lead = (await t.call('GET', '/crm/leads?search=Riya', { token: admin.token })).body.items[0];
  assert.equal(lead.status, 'new');
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/activities`, { token: admin.token, body: { type: 'status_change' } })).status, 400);
  assert.equal((await t.call('POST', `/crm/leads/${lead.id}/activities`, { token: admin.token, body: { type: 'note' } })).status, 400, 'empty note');
  const follow = new Date(Date.now() + 3600000).toISOString();
  const call = await t.call('POST', `/crm/leads/${lead.id}/activities`, {
    token: admin.token, body: { type: 'call', outcome: 'connected', body: 'Wants a visit', durationSeconds: 120, nextFollowUpAt: follow },
  });
  assert.equal(call.status, 201);
  assert.equal(call.body.lead.status, 'contacted');
  assert.equal(call.body.lead.nextFollowUpAt, follow);

  const list = await t.call('GET', `/crm/leads/${lead.id}/activities?type=call,status_change`, { token: admin.token });
  assert.deepEqual([...new Set(list.body.items.map((a) => a.type))].sort(), ['call', 'status_change']);
  const sys = list.body.items.find((a) => a.type === 'status_change');
  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}/activities/${sys.id}`, { token: superadmin.token, body: { body: 'x' } })).status, 403);

  const other = await t.login('9000000001');
  const promoted = await t.login('9833333333');
  await t.call('PATCH', `/crm/users/${promoted.user.id}`, { token: superadmin.token, body: { role: 'admin' } });
  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}/activities/${call.body.activity.id}`, { token: promoted.token, body: { body: 'edit' } })).status, 403);
  assert.equal((await t.call('PATCH', `/crm/leads/${lead.id}/activities/${call.body.activity.id}`, { token: other.token, body: { body: 'edited' } })).body.activity.body, 'edited');
  await t.call('PATCH', `/crm/users/${promoted.user.id}`, { token: superadmin.token, body: { role: 'user' } });
});

test('follow-ups and reminders', async () => {
  const lead = (await t.call('GET', '/crm/leads?search=Riya', { token: admin.token })).body.items[0];
  const visitAt = new Date(Date.now() + 2 * 3600000);
  await t.call('POST', `/crm/leads/${lead.id}/activities`, { token: admin.token, body: { type: 'site_visit', scheduledAt: visitAt.toISOString(), body: 'Sat visit' } });
  const week = await t.call('GET', '/crm/follow-ups?when=week', { token: admin.token });
  assert.equal(week.status, 200);
  assert.equal(week.body.leads.length, 1);
  assert.equal(week.body.visits.length, 1);
  assert.equal(week.body.visits[0].leadName, 'Riya Buyer');
  assert.equal((await t.call('GET', '/crm/follow-ups?when=soon', { token: admin.token })).status, 400);

  await t.call('PATCH', `/crm/leads/${lead.id}`, { token: admin.token, body: { nextFollowUpAt: new Date(Date.now() - 60000).toISOString() } });
  assert.equal((await t.call('GET', '/crm/leads?followUp=overdue', { token: admin.token })).body.total, 1);
  assert.equal(await sendDueReminders(), 1);
  assert.equal(await sendDueReminders(), 0, 'each follow-up notifies once');
  assert.ok(models.Notification._rows.some((n) => String(n.user) === admin.user.id && n.title === 'Follow-up due'));
});

test('manual leads: validation, linking to an existing customer, duplicate detection', async () => {
  assert.equal((await t.call('POST', '/crm/leads', { token: admin.token, body: { phone: '123' } })).status, 400);
  const walkIn = await t.call('POST', '/crm/leads', { token: admin.token, body: { name: 'Walk In', phone: '9744444444', source: 'walk_in', note: 'Came to office', assignedTo: 'me' } });
  assert.equal(walkIn.status, 201);
  assert.equal(walkIn.body.lead.user, null);
  assert.equal(walkIn.body.lead.assignedTo.id, admin.user.id);
  assert.equal((await t.call('POST', '/crm/leads', { token: admin.token, body: { phone: '9744444444', assignedTo: superadmin.user.id } })).status, 403);

  const dup = await t.call('POST', '/crm/leads', { token: admin.token, body: { phone: '9811111111', propertyId } });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.existingLeadId);
  const linked = await t.call('POST', '/crm/leads', { token: admin.token, body: { phone: '9811111111', propertyId: publicIds()[1], source: 'call' } });
  assert.equal(linked.status, 201);
  assert.equal(linked.body.lead.user, user.user.id);
  assert.equal(linked.body.lead.name, 'Riya Buyer');
});

test('bulk lead actions and super-admin delete', async () => {
  const ids = (await t.call('GET', '/crm/leads', { token: admin.token })).body.items.map((l) => l.id);
  const r = await t.call('POST', '/crm/leads/bulk', { token: admin.token, body: { ids: [...ids, String(t.oid())], action: 'priority', value: 'cold' } });
  assert.equal(r.body.updated, ids.length);
  assert.equal(r.body.failed.length, 1);
  assert.equal((await t.call('POST', '/crm/leads/bulk', { token: admin.token, body: { ids, action: 'delete' } })).status, 403);
  assert.equal((await t.call('POST', '/crm/leads/bulk', { token: admin.token, body: { ids, action: 'explode' } })).status, 400);

  const walkIn = (await t.call('GET', '/crm/leads?search=Walk', { token: admin.token })).body.items[0];
  assert.equal((await t.call('DELETE', `/crm/leads/${walkIn.id}`, { token: admin.token })).status, 403);
  assert.equal((await t.call('DELETE', `/crm/leads/${walkIn.id}`, { token: superadmin.token })).status, 200);
  assert.equal(models.LeadActivity._rows.filter((a) => String(a.lead) === walkIn.id).length, 0);
});

test('export: CSV with formula cells defused, JSON, audited', async () => {
  await t.call('POST', '/crm/leads', { token: superadmin.token, body: { name: '=HYPERLINK("x")', phone: '9755555555' } });
  const csv = await t.call('GET', '/crm/leads/export', { token: superadmin.token });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /attachment; filename="leads-/);
  const json = await t.call('GET', '/crm/leads/export?format=json&search=9755555555', { token: superadmin.token });
  assert.equal(json.body.total, 1);
  assert.ok(models.AuditLog._rows.some((a) => a.action === 'export'));
  const raw = await fetch(`${t.base}/crm/leads/export?search=9755555555`, { headers: { Authorization: `Bearer ${superadmin.token}` } });
  const text = await raw.text();
  assert.match(text, /"'=HYPERLINK\(""x""\)"/);
});

test('enquiries list links to leads; views list filters', async () => {
  const e = await t.call('GET', '/crm/enquiries', { token: admin.token });
  assert.ok(e.body.items.every((i) => i.leadId));
  assert.equal((await t.call('PATCH', `/crm/enquiries/${e.body.items[0].id}`, { token: admin.token, body: { status: 'nope' } })).status, 400);
  assert.equal((await t.call('PATCH', `/crm/enquiries/${e.body.items[0].id}`, { token: admin.token, body: { status: 'closed' } })).body.enquiry.status, 'closed');
  assert.equal((await t.call('GET', `/crm/views?propertyId=${propertyId}&minViews=2`, { token: admin.token })).body.total, 1);
});

test('properties: list with hidden ones and counts, detail, approve/reject notify the owner', async () => {
  const props = await t.call('GET', '/crm/properties?approvalStatus=pending', { token: admin.token });
  assert.deepEqual(props.body.items.map((p) => p.title).sort(), ['Hidden Pending Listing', 'Owner Flat']);
  const all = await t.call('GET', '/crm/properties?limit=50', { token: admin.token });
  assert.equal(all.body.items.find((p) => p.id === propertyId).leadCount, 1);
  assert.equal((await t.call('GET', `/crm/properties?ownerUserId=${user2.user.id}`, { token: admin.token })).body.total, 1);

  const d = await t.call('GET', `/crm/properties/${propertyId}`, { token: admin.token });
  assert.equal(d.body.counts.views, 2);
  assert.equal(d.body.counts.saves, 1);
  assert.equal(d.body.editable, false);
  assert.equal((await t.call('GET', `/crm/properties/${propertyId}/leads`, { token: admin.token })).body.total, 1);

  assert.equal((await t.call('PATCH', `/crm/properties/${manualOwnedId}`, { token: admin.token, body: { approvalStatus: 'rejected' } })).status, 400, 'reject needs a reason');
  const rej = await t.call('PATCH', `/crm/properties/${manualOwnedId}`, { token: admin.token, body: { approvalStatus: 'rejected', rejectionReason: 'Blurry photos' } });
  assert.equal(rej.body.property.rejectionReason, 'Blurry photos');
  const ok = await t.call('PATCH', `/crm/properties/${manualOwnedId}`, { token: admin.token, body: { approvalStatus: 'approved' } });
  assert.equal(ok.body.property.rejectionReason, '');
  assert.equal(ok.body.property.reviewedBy.id, admin.user.id);
  const notes = models.Notification._rows.filter((n) => String(n.user) === user2.user.id).map((n) => n.title);
  assert.deepEqual(notes, ['Your listing was not approved', 'Your listing is live']);
  assert.ok(models.Notification._rows.some((n) => n.type === 'approval'), 'staff heard about the pending post');
});

test('properties: staff edit app-posted listings (incl. location), imported ones only moderated', async () => {
  const edit = await t.call('PATCH', `/crm/properties/${manualOwnedId}`, { token: admin.token, body: { price: 7500000, locality: 'Hinjewadi' } });
  assert.equal(edit.status, 200);
  const row = models.Property._rows.find((p) => String(p._id) === manualOwnedId);
  assert.equal(row.price, 7500000);
  assert.equal(row.locality, 'Hinjewadi');
  assert.equal(row.filterFields.price, 7500000);
  assert.equal((await t.call('PATCH', `/crm/properties/${manualOwnedId}`, { token: admin.token, body: { price: -1 } })).status, 400);
  assert.equal((await t.call('PATCH', `/crm/properties/${propertyId}`, { token: admin.token, body: { price: 1 } })).status, 403);
  assert.equal((await t.call('PATCH', `/crm/properties/${propertyId}`, { token: admin.token, body: { featured: true } })).status, 200);
  assert.equal((await t.call('PATCH', `/crm/properties/${t.oid()}`, { token: admin.token, body: { featured: true } })).status, 404);
});

test('properties: staff post on behalf of an owner; bulk; delete closes open leads', async () => {
  assert.equal((await t.call('POST', '/crm/properties', { token: admin.token, body: { title: 'x' } })).status, 400);
  const created = await t.call('POST', '/crm/properties', {
    token: admin.token,
    body: { ownerUserId: user.user.id, title: 'Staff Posted', city: 'Mumbai', locality: 'Juhu', propertyType: 'Flats/Apartments', bhk: '3', price: 50000000, area: 1500, description: 'Sea facing apartment', featured: true },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.property.approvalStatus, 'approved');
  assert.equal(created.body.property.ownerUserId, user.user.id);
  const mine = await t.call('GET', '/users/me/properties', { token: user.token });
  assert.ok(mine.body.items.some((p) => p.title === 'Staff Posted'), 'shows in the owner\'s listings');

  const bulk = await t.call('POST', '/crm/properties/bulk', { token: admin.token, body: { ids: [pendingId, created.body.property.id], action: 'approve' } });
  assert.equal(bulk.body.updated, 2);
  assert.equal((await t.call('POST', '/crm/properties/bulk', { token: admin.token, body: { ids: [pendingId], action: 'delete' } })).status, 403);

  const newId = created.body.property.id;
  await t.call('POST', '/enquiries', { token: user2.token, body: { propertyId: newId, message: 'Hi' } });
  assert.equal((await t.call('DELETE', `/crm/properties/${propertyId}`, { token: superadmin.token })).status, 403, 'imported data is protected');
  assert.equal((await t.call('DELETE', `/crm/properties/${newId}`, { token: admin.token })).status, 403);
  assert.equal((await t.call('DELETE', `/crm/properties/${newId}`, { token: superadmin.token })).status, 200);
  const lead = models.Lead._rows.find((l) => String(l.property) === newId);
  assert.equal(lead.status, 'lost');
  assert.equal(lead.lostReason, 'listing_removed');
});

test('reviews: staff remove abusive reviews and the rating recalculates', async () => {
  await t.call('POST', `/properties/${propertyId}/reviews`, { token: user.token, body: { rating: 1, comment: 'spam' } });
  const review = String(models.Review._rows[0]._id);
  assert.equal((await t.call('DELETE', `/crm/reviews/${review}`, { token: user.token })).status, 403);
  assert.equal((await t.call('DELETE', `/crm/reviews/${review}`, { token: admin.token })).status, 200);
  assert.equal(models.PropertyRating._rows[0].count, 0);
});

test('users: phone and email accounts in one list; detail; notify', async () => {
  const signup = await t.call('POST', '/auth/signup', { body: { data: { fullName: 'Email Person', email: 'person@example.com', password: 'longpassword1' } } });
  assert.equal(signup.status, 201);
  const all = await t.call('GET', '/crm/users?limit=50', { token: admin.token });
  assert.ok(all.body.items.some((u) => u.accountType === 'email' && u.email === 'person@example.com'));
  assert.ok(all.body.items.some((u) => u.accountType === 'phone'));
  assert.equal(all.body.total, models.User._rows.length + models.SignUpUser._rows.length);
  assert.equal((await t.call('GET', '/crm/users?search=person@example', { token: admin.token })).body.total, 1);
  assert.equal((await t.call('GET', '/crm/users?accountType=phone&city=Pune', { token: admin.token })).body.total, 1);

  const d = await t.call('GET', `/crm/users/${user.user.id}`, { token: admin.token });
  assert.equal(d.body.counts.saved, 1);
  assert.ok(d.body.counts.leads >= 2);
  assert.ok(d.body.recentLeads.length >= 2);
  assert.equal((await t.call('GET', `/crm/users/${user2.user.id}/properties`, { token: admin.token })).body.total, 1);
  assert.ok((await t.call('GET', `/crm/users/${user.user.id}/leads`, { token: admin.token })).body.total >= 2);

  assert.equal((await t.call('POST', `/crm/users/${user.user.id}/notify`, { token: admin.token, body: { title: 'Hi' } })).status, 400);
  assert.equal((await t.call('POST', `/crm/users/${user.user.id}/notify`, { token: admin.token, body: { title: 'Price drop', message: 'Check it out', type: 'price', data: { propertyId } } })).status, 201);
  const mine = await t.call('GET', '/notifications', { token: user.token });
  assert.ok(JSON.stringify(mine.body).includes('Price drop'));
});

test('users: only super admins change roles or block, never themselves, never the last super admin', async () => {
  assert.equal((await t.call('PATCH', `/crm/users/${user.user.id}`, { token: admin.token, body: { isActive: false } })).status, 403);
  assert.equal((await t.call('PATCH', `/crm/users/${superadmin.user.id}`, { token: superadmin.token, body: { role: 'user' } })).status, 400);
  assert.equal((await t.call('PATCH', `/crm/users/${user.user.id}`, { token: superadmin.token, body: { role: 'root' } })).status, 400);
  const emailUser = models.SignUpUser._rows[0];
  assert.equal((await t.call('PATCH', `/crm/users/${emailUser._id}`, { token: superadmin.token, body: { isActive: false } })).status, 200, 'email accounts can be blocked');
  const signin = await t.call('POST', '/auth/signin', { body: { email: 'person@example.com', password: 'longpassword1' } });
  assert.equal(signin.status, 403);

  // Promote a second super admin, then the first may be demoted, but not the last one.
  await t.call('PATCH', `/crm/users/${user2.user.id}`, { token: superadmin.token, body: { role: 'superadmin' } });
  assert.equal((await t.call('PATCH', `/crm/users/${superadmin.user.id}`, { token: user2.token, body: { role: 'admin' } })).status, 200);
  assert.equal((await t.call('PATCH', `/crm/users/${superadmin.user.id}`, { token: user2.token, body: { role: 'superadmin' } })).status, 200);
  await t.call('PATCH', `/crm/users/${user2.user.id}`, { token: superadmin.token, body: { role: 'user' } });
  assert.equal((await t.call('GET', '/crm/stats', { token: user2.token })).status, 403, 'demotion takes effect immediately');
});

test('staff: create email staff who can sign in, edit, reset password, deactivate with lead hand-over', async () => {
  const body = { fullName: 'Neha Ops', email: 'neha@avodahgroup.co', role: 'admin', password: 'temporary123' };
  assert.equal((await t.call('POST', '/crm/staff', { token: superadmin.token, body: { ...body, password: 'short' } })).status, 400);
  const created = await t.call('POST', '/crm/staff', { token: superadmin.token, body });
  assert.equal(created.status, 201);
  assert.equal((await t.call('POST', '/crm/staff', { token: superadmin.token, body })).status, 409);
  const neha = (await t.call('POST', '/auth/signin', { body: { email: body.email, password: body.password } })).body;
  assert.equal((await t.call('GET', '/crm/me', { token: neha.token })).body.user.role, 'admin');

  assert.equal((await t.call('POST', '/crm/me/password', { token: neha.token, body: { currentPassword: 'wrong', newPassword: 'newpassword1' } })).status, 401);
  assert.equal((await t.call('POST', '/crm/me/password', { token: neha.token, body: { currentPassword: body.password, newPassword: 'newpassword1' } })).status, 200);
  assert.equal((await t.call('POST', `/crm/staff/${neha.user.id}/reset-password`, { token: superadmin.token, body: { password: 'resetpass99' } })).status, 200);
  assert.equal((await t.call('POST', '/auth/signin', { body: { email: body.email, password: 'resetpass99' } })).status, 200);
  assert.equal((await t.call('POST', `/crm/staff/${admin.user.id}/reset-password`, { token: superadmin.token, body: { password: 'resetpass99' } })).status, 400, 'OTP staff have no password');

  const short = await t.call('GET', '/crm/staff', { token: admin.token });
  assert.deepEqual(Object.keys(short.body.items[0]).sort(), ['id', 'name', 'role']);
  const full = await t.call('GET', '/crm/staff', { token: superadmin.token });
  assert.ok(full.body.items.find((s) => s.id === admin.user.id).openLeads >= 1);
  assert.equal((await t.call('PATCH', `/crm/staff/${neha.user.id}`, { token: superadmin.token, body: { fullName: 'Neha P' } })).body.staff.name, 'Neha P');
  assert.equal((await t.call('PATCH', `/crm/staff/${user.user.id}`, { token: superadmin.token, body: { fullName: 'x y' } })).status, 404);

  const lead = (await t.call('GET', '/crm/leads?assignedTo=me', { token: admin.token })).body.items[0];
  assert.equal((await t.call('DELETE', `/crm/staff/${admin.user.id}`, { token: superadmin.token, body: { reassignTo: user.user.id } })).status, 400);
  const off = await t.call('DELETE', `/crm/staff/${admin.user.id}`, { token: superadmin.token, body: { reassignTo: neha.user.id } });
  assert.equal(off.status, 200);
  assert.ok(off.body.leadsMoved >= 1);
  assert.equal((await t.call('GET', `/crm/leads/${lead.id}`, { token: superadmin.token })).body.lead.assignedTo.id, neha.user.id);
  assert.equal((await t.call('GET', '/crm/stats', { token: admin.token })).status, 401, 'deactivated staff lose access at once');
  await t.call('PATCH', `/crm/staff/${admin.user.id}`, { token: superadmin.token, body: { isActive: true } });
});

test('dashboard: stats, trends, staff performance', async () => {
  const s = await t.call('GET', '/crm/stats', { token: admin.token });
  assert.ok(s.body.leads.total >= 3);
  assert.equal(Object.values(s.body.leads.byStatus).reduce((a, b) => a + b, 0), s.body.leads.total);
  assert.ok(s.body.users >= 4);
  const tr = await t.call('GET', '/crm/stats/trends?metric=leads&groupBy=source', { token: admin.token });
  assert.equal(tr.status, 200);
  assert.equal(tr.body.points.length, 30);
  assert.equal(tr.body.points.reduce((n, p) => n + p.value, 0), s.body.leads.total);
  assert.equal((await t.call('GET', '/crm/stats/trends?metric=money', { token: admin.token })).status, 400);
  assert.equal((await t.call('GET', '/crm/stats/trends?metric=users&interval=month', { token: admin.token })).status, 200);
  const perf = await t.call('GET', '/crm/stats/staff-performance', { token: superadmin.token });
  assert.ok(perf.body.items.some((i) => i.assigned >= 1));
});

test('settings: admins read, super admins write; auto-approve and auto-assign take effect', async () => {
  assert.equal((await t.call('GET', '/crm/settings', { token: admin.token })).body.settings.leads.viewThreshold, 1);
  assert.equal((await t.call('PATCH', '/crm/settings', { token: superadmin.token, body: { leads: { autoAssign: 'random' } } })).status, 400);
  assert.equal((await t.call('PATCH', '/crm/settings', { token: superadmin.token, body: {} })).status, 400);
  const r = await t.call('PATCH', '/crm/settings', { token: superadmin.token, body: { autoApprovePosts: true, leads: { autoAssign: 'least_loaded', viewThreshold: 3 } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.settings.leads.scoreWeights.enquiry, 40, 'untouched values keep their defaults');

  const posted = await t.call('POST', '/post-property', {
    token: user.token,
    body: { title: 'Auto Live', city: 'Pune', locality: 'Aundh', propertyType: 'Flats/Apartments', bhk: '1', price: 4000000, area: 500, description: 'Compact flat in Aundh' },
  });
  assert.equal(posted.body.property.approvalStatus, 'approved');

  const viewer = await t.login('9844440000');
  const target = publicIds()[2];
  await t.call('POST', `/properties/${target}/view`, { token: viewer.token });
  assert.equal(models.Lead._rows.filter((l) => String(l.user) === viewer.user.id).length, 0, 'below the view threshold');
  await t.call('POST', '/enquiries', { token: viewer.token, body: { propertyId: target, message: 'Call me' } });
  const lead = models.Lead._rows.find((l) => String(l.user) === viewer.user.id);
  assert.ok(lead.assignedTo, 'auto-assigned to the least loaded staff member');
  await t.call('PATCH', '/crm/settings', { token: superadmin.token, body: { autoApprovePosts: false, leads: { autoAssign: 'none', viewThreshold: 1 } } });
});

test('audit log: super admins see who changed what', async () => {
  const log = await t.call('GET', '/crm/audit-log?entity=lead', { token: superadmin.token });
  assert.equal(log.status, 200);
  assert.ok(log.body.items.length > 0);
  const statusChange = log.body.items.find((a) => a.changes.status);
  assert.ok(statusChange.actor.name !== undefined && statusChange.actor.role);
  assert.equal((await t.call('GET', '/crm/audit-log?entity=planet', { token: superadmin.token })).status, 400);
  const settings = await t.call('GET', '/crm/audit-log?entity=settings', { token: superadmin.token });
  assert.ok(settings.body.total >= 2);
  assert.ok(!JSON.stringify(models.AuditLog._rows).includes('resetpass99'), 'passwords never reach the audit log');
});
