const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const { setVerifier } = require('../src/utils/firebase');
const { parseQuery } = require('../src/controllers/v2-properties-controller');
const seed = require('./seed');

// Fake Firebase: tokens look like "fb|<uid>|<phone>|<email>|<verified>"; anything else is invalid.
setVerifier(async (token) => {
  const [tag, uid, phone, email, verified] = token.split('|');
  if (tag !== 'fb' || !uid) throw new Error('invalid');
  return { uid, ...(phone ? { phone_number: phone } : {}), ...(email ? { email, email_verified: verified === '1' } : {}) };
});
const fb = (uid, { phone = '', email = '', verified = true } = {}) => `fb|${uid}|${phone}|${email}|${verified ? 1 : 0}`;

let t; let ids; let skyline; let harbour; let pending; let lakeview;
test.before(async () => {
  t = await startServer();
  models.Property.seed(seed);
  const byTitle = (s) => String(models.Property._rows.find((p) => (p.title || p.name) === s)._id);
  skyline = byTitle('Skyline Residency');
  harbour = byTitle('Harbour Heights');
  lakeview = byTitle('Lakeview Towers');
  pending = byTitle('Hidden Pending Listing');
  ids = [skyline, harbour, lakeview, byTitle('Green Acres Plot')];
});
test.after(() => t.close());

test('auth: 401 with the contract messages', async () => {
  const r1 = await t.call('GET', '/v2/customerActivity/my-activity');
  assert.deepEqual([r1.status, r1.body], [401, { message: 'No token' }]);
  const r2 = await t.call('GET', '/v2/customerActivity/my-activity', { token: 'garbage' });
  assert.deepEqual([r2.status, r2.body], [401, { message: 'Invalid token' }]);
  const v1 = await t.login('9811100000');
  assert.equal((await t.call('GET', '/v2/customerActivity/my-activity', { token: v1.token })).body.message, 'Invalid token', 'v1 JWTs are not accepted');
  const r3 = await t.call('GET', '/v2/customerActivity/my-activity', { token: fb('nobody', { phone: '+919800000000' }) });
  assert.deepEqual([r3.status, r3.body], [401, { message: 'Customer not found' }]);
});

test('register: phone sign-in links the existing OTP account; verified email creates one', async () => {
  const v1 = await t.login('9822200000');
  const tok = fb('uid-phone', { phone: '+919822200000' });
  const r = await t.call('POST', '/v2/customers/register', { token: tok });
  assert.equal(r.status, 200);
  assert.equal(r.body.customer.id, v1.user.id);
  assert.equal(r.body.created, false);
  assert.equal(r.body.user.id, v1.user.id);
  assert.equal((await t.call('GET', '/users/me', { token: r.body.token })).status, 200, 'returns a working v1 session token');
  assert.equal((await t.call('POST', '/v2/customers/register', { token: tok })).body.customer.id, v1.user.id, 'idempotent');

  const fresh = await t.call('POST', '/v2/customers/register', { token: fb('uid-new', { phone: '+919833300000' }), body: { name: 'New One' } });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.customer.name, 'New One');

  assert.equal((await t.call('POST', '/v2/customers/register', { token: fb('uid-mail', { email: 'a@b.co', verified: false }) })).status, 400);
  const mail = await t.call('POST', '/v2/customers/register', { token: fb('uid-mail', { email: 'A@b.co' }) });
  assert.equal(mail.status, 201);
  assert.equal(mail.body.customer.accountType, 'email');
  assert.equal(mail.body.customer.email, 'a@b.co');
  assert.equal((await t.call('POST', '/v2/customers/register', { token: fb('uid-other', { phone: '+919822200000' }) })).status, 409);
  assert.equal((await t.call('POST', '/v2/customers/register', { token: fb('uid-anon') })).status, 400);
  assert.equal((await t.call('POST', '/v2/customers/register')).status, 401);
});

test('GET /properties: contract shape, filters, sorting, paging, hidden listings excluded', async () => {
  const r = await t.call('GET', '/v2/properties');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['page', 'properties', 'totalMatched', 'totalPages']);
  assert.equal(r.body.totalMatched, 4);
  assert.equal(r.body.totalPages, 1);
  assert.ok(!r.body.properties.some((p) => p._id === pending));
  assert.equal((await t.call('GET', '/v2/properties?city=mumbai')).body.totalMatched, 3);
  assert.equal((await t.call('GET', '/v2/properties?bhk=3')).body.totalMatched, 2);
  assert.equal((await t.call('GET', '/v2/properties?bhk=2&bhk=3')).body.totalMatched, 3);
  assert.equal((await t.call('GET', '/v2/properties?bhk=3%2B')).body.totalMatched, 2);
  assert.equal((await t.call('GET', '/v2/properties?locality=Colaba&locality=Baner')).body.totalMatched, 2);
  assert.equal((await t.call('GET', '/v2/properties?priceMax=13000000')).body.totalMatched, 2);
  assert.equal((await t.call('GET', '/v2/properties?amenities=gym')).body.totalMatched, 1);
  assert.equal((await t.call('GET', '/v2/properties?areaMin=80&areaMax=100&areaUnit=sqmts')).body.totalMatched, 1, '950 sq.ft is about 88 sq.m');
  assert.equal((await t.call('GET', '/v2/properties?search=skyline')).body.totalMatched, 1);
  assert.equal((await t.call('GET', '/v2/properties?bhk=banana&sortBy=weird')).body.totalMatched, 4, 'invalid values are ignored');
  const cheap = (await t.call('GET', '/v2/properties?sortBy=price-low-high')).body.properties.map((p) => p.price);
  assert.deepEqual(cheap, [...cheap].sort((a, b) => a - b));
  const paged = await t.call('GET', '/v2/properties?limit=1&page=2');
  assert.equal(paged.body.properties.length, 1);
  assert.equal(paged.body.totalPages, 4);
  assert.equal((await t.call('GET', '/v2/properties?limit=500')).status, 200);
});

test('GET /properties/:id: bare contract object, 400/404 with { success:false }', async () => {
  const r = await t.call('GET', `/v2/properties/${skyline}`);
  assert.equal(r.status, 200);
  assert.equal(r.body._id, skyline);
  assert.equal(r.body.title, 'Skyline Residency');
  assert.equal(r.body.price, 12500000);
  assert.equal(r.body.bhk, 2);
  assert.deepEqual(r.body.area, { value: 950, unit: 'sqft' });
  assert.equal(r.body.reraApproved, true);
  assert.deepEqual(r.body.coverImage, { url: 'https://img.test/a.jpg' });
  for (const hidden of ['filterFields', 'ownerUserId', 'approvalStatus', 'contactPhone']) assert.ok(!(hidden in r.body), hidden);
  assert.deepEqual((await t.call('GET', '/v2/properties/nope')).body, { success: false, message: 'Invalid property ID.' });
  const missing = await t.call('GET', `/v2/properties/${t.oid()}`);
  assert.deepEqual([missing.status, missing.body], [404, { success: false, message: 'Property not found.' }]);
  assert.equal((await t.call('GET', `/v2/properties/${pending}`)).status, 404, 'pending listings look missing');
});

test('filters, localities and location autocomplete', async () => {
  const f = await t.call('GET', '/v2/properties/filters');
  assert.deepEqual(f.body.cities, ['Mumbai', 'Pune']);
  assert.ok(f.body.amenitiesOptions.includes('Gym'));
  assert.deepEqual(Object.keys(f.body.areaBounds).sort(), ['acres', 'guntas', 'hectares', 'sqft', 'sqmts']);
  assert.ok(f.body.areaBounds.sqft.max >= 1450);

  assert.deepEqual((await t.call('GET', '/v2/properties/localities/x')).body, { success: false, message: 'A valid city name is required.' });
  assert.deepEqual((await t.call('GET', '/v2/properties/localities/pune')).body, { localities: ['Baner'] });
  const byType = await t.call('GET', '/v2/properties/localities-by-type');
  assert.ok(byType.body.residential.includes('Andheri West'));
  assert.ok(Array.isArray(byType.body.commercial));

  const loc = await t.call('GET', '/v2/properties/location-options?q=andh');
  assert.deepEqual(loc.body[0], { label: 'Andheri West, Mumbai', city: 'Mumbai', locality: 'Andheri West', pincode: null, type: 'locality' });
  assert.deepEqual((await t.call('GET', '/v2/properties/location-options?q=a')).body, []);
  assert.equal((await t.call('GET', '/v2/properties/location-options?q=mum&city=pune')).body.length, 0);
});

test('featured, recent and related lists', async () => {
  const feat = await t.call('GET', '/v2/properties/featured');
  assert.equal(feat.body.length, 1);
  assert.equal(feat.body[0].pricePerSqft, Math.round(12500000 / 950));
  assert.ok('reraDate' in feat.body[0] && 'galleryImages' in feat.body[0]);
  const recent = await t.call('GET', '/v2/properties/recent?limit=2');
  assert.equal(recent.body.length, 2);
  assert.deepEqual(Object.keys(recent.body[0]).sort(), ['_id', 'area', 'bhk', 'city', 'coverImage', 'createdAt', 'developerName', 'furnishing', 'locality', 'price', 'propertyType', 'slug', 'title'].sort());
  const rel = await t.call('GET', `/v2/properties/related/${skyline}`);
  assert.deepEqual(rel.body.map((p) => p._id), [harbour], 'same developer');
  assert.equal((await t.call('GET', '/v2/properties/related/bad')).status, 400);
  assert.equal((await t.call('GET', `/v2/properties/related/${pending}`)).status, 404);
});

test('instant search: natural-language parsing, regex match, fuzzy fallback', async () => {
  assert.deepEqual(parseQuery('3bhk under 50 lakh in Whitefield'), { maxPrice: 5000000, bhk: 3, place: 'whitefield', text: '' });
  assert.deepEqual(parseQuery('villa above 1 crore'), { minPrice: 10000000, text: 'villa' });
  const between = parseQuery('between 40 lakh and 80 lakh');
  assert.equal(between.minPrice, 4000000);
  assert.equal(between.maxPrice, 8000000);
  assert.equal(parseQuery('rera approved semi-furnished flat').furnishing, 'semi');

  const hit = await t.call('GET', '/v2/properties/search?query=2bhk%20under%202%20crore%20in%20andheri');
  assert.equal(hit.body.fuzzy, false);
  assert.deepEqual(hit.body.properties.map((p) => p.title), ['Skyline Residency']);
  assert.ok('state' in hit.body.properties[0]);
  const words = await t.call('GET', '/v2/properties/search?query=harbour');
  assert.deepEqual(words.body.properties.map((p) => p.title), ['Harbour Heights']);
  const typo = await t.call('GET', '/v2/properties/search?query=skylin%20residensy');
  assert.equal(typo.body.fuzzy, true);
  assert.equal(typo.body.properties[0].title, 'Skyline Residency');
  assert.ok(!('state' in typo.body.properties[0]) && !('galleryImages' in typo.body.properties[0]));
  const place = await t.call('GET', '/v2/properties/search?query=flats%20in%20colabba');
  assert.equal(place.body.fuzzy, true, 'fuse.js matches a misspelt place');
  assert.equal(place.body.properties[0].title, 'Harbour Heights');
  assert.deepEqual((await t.call('GET', '/v2/properties/search?query=a')).body, { properties: [], fuzzy: false });
  assert.deepEqual((await t.call('GET', '/v2/properties/search?query=zzzzqqqq')).body, { properties: [], fuzzy: false });
  assert.equal((await t.call('GET', '/v2/properties/search?query=flat&limit=50')).status, 200);
});

test('hearts: toggle, shared with v1 saves, cap of 200, feeds the CRM', async () => {
  const tok = fb('uid-phone', { phone: '+919822200000' });
  assert.deepEqual((await t.call('POST', '/v2/customerActivity/toggle-heart/bad', { token: tok })).body, { message: 'Invalid property ID' });
  assert.equal((await t.call('POST', `/v2/customerActivity/toggle-heart/${t.oid()}`, { token: tok })).status, 404);
  const on = await t.call('POST', `/v2/customerActivity/toggle-heart/${skyline}`, { token: tok });
  assert.deepEqual(on.body, { success: true, isHearted: true, heartedIds: [skyline] });
  await t.call('POST', `/v2/customerActivity/toggle-heart/${harbour}`, { token: tok });
  const off = await t.call('POST', `/v2/customerActivity/toggle-heart/${skyline}`, { token: tok });
  assert.deepEqual(off.body, { success: true, isHearted: false, heartedIds: [harbour] });

  const owner = models.User._rows.find((u) => u.firebaseUid === 'uid-phone');
  const v1 = await t.login('9822200000');
  assert.deepEqual((await t.call('GET', '/properties/saved/list', { token: v1.token })).body.items.map((p) => p.id), [harbour], 'same list as the v1 app');
  assert.ok(models.Lead._rows.some((l) => String(l.user) === String(owner._id) && l.sources.includes('saved')));

  const full = models.User._rows.find((u) => u.firebaseUid === 'uid-new');
  full.savedProperties = Array.from({ length: 200 }, () => t.oid());
  const capped = await t.call('POST', `/v2/customerActivity/toggle-heart/${skyline}`, { token: fb('uid-new') });
  assert.deepEqual([capped.status, capped.body], [400, { message: 'You can only save up to 200 properties.' }]);
  full.savedProperties = [];
});

test('my-activity and compare: paginated hearts, compare is a full replace capped at 4', async () => {
  const tok = fb('uid-phone', { phone: '+919822200000' });
  for (const id of [skyline, lakeview]) await t.call('POST', `/v2/customerActivity/toggle-heart/${id}`, { token: tok });
  const a = await t.call('GET', '/v2/customerActivity/my-activity?heartLimit=2', { token: tok });
  assert.equal(a.body.success, true);
  assert.deepEqual(a.body.heartedIds, [harbour, skyline, lakeview]);
  assert.deepEqual(a.body.heartProperties.map((p) => p._id), [lakeview, skyline], 'newest first');
  assert.deepEqual(Object.keys(a.body.heartProperties[0]).sort(), ['_id', 'bhk', 'city', 'coverImage', 'locality', 'price', 'propertyType', 'title']);
  assert.deepEqual(a.body.heartPagination, { page: 1, limit: 2, total: 3, hasMore: true });
  const p2 = await t.call('GET', '/v2/customerActivity/my-activity?heartLimit=2&heartPage=2', { token: tok });
  assert.deepEqual(p2.body.heartProperties.map((p) => p._id), [harbour]);
  assert.equal((await t.call('GET', '/v2/customerActivity/my-activity?heartLimit=999', { token: tok })).body.heartPagination.limit, 50);
  assert.deepEqual(a.body.compareProperties, []);

  assert.deepEqual((await t.call('PUT', '/v2/customerActivity/compare', { token: tok, body: { propertyIds: 'x' } })).body, { message: 'propertyIds must be an array' });
  const set = await t.call('PUT', '/v2/customerActivity/compare', { token: tok, body: { propertyIds: [skyline, 'bad-id', harbour, lakeview, ids[3], pending] } });
  assert.equal(set.status, 200);
  assert.deepEqual(set.body.compareProperties.map((p) => p._id), [skyline, harbour, lakeview, ids[3]], 'bad ids dropped, first 4 kept');
  const replaced = await t.call('PUT', '/v2/customerActivity/compare', { token: tok, body: { propertyIds: [harbour] } });
  assert.deepEqual(replaced.body.compareProperties.map((p) => p._id), [harbour], 'full replace, not append');
  assert.deepEqual((await t.call('GET', '/v2/customerActivity/my-activity', { token: tok })).body.compareProperties.map((p) => p._id), [harbour]);
});

test('leads: public, validated, deduplicated for 24h, and fed into the CRM', async () => {
  const bad = await t.call('POST', '/v2/leads/customer', { body: { customerName: 'A', customerEmail: 'x', customerPhone: '12345', source: 'nope', loanInterest: 'yes' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.success, false);
  assert.equal(bad.body.message, 'Validation failed');
  assert.deepEqual(bad.body.errors.formErrors, []);
  assert.deepEqual(bad.body.errors.fieldErrors.customerPhone, ['Invalid 10-digit Indian mobile number']);
  assert.deepEqual(bad.body.errors.fieldErrors.customerName, ['Name must be at least 2 characters']);
  assert.deepEqual(Object.keys(bad.body.errors.fieldErrors).sort(), ['customerEmail', 'customerName', 'customerPhone', 'loanInterest', 'source']);
  const notObject = await t.call('POST', '/v2/leads/customer', { body: [1] });
  assert.equal(notObject.status, 400);
  assert.equal(notObject.body.errors.formErrors.length, 1, 'zod reports a non-object body under formErrors');

  const body = { customerName: 'Asha', customerEmail: 'Asha@Example.com', customerPhone: '9876501234', source: 'property_page_contact', propertyId: skyline, message: 'Call me', budget: '1-2 Cr', loanInterest: true, extra: 'ignored' };
  const ok = await t.call('POST', '/v2/leads/customer', { body });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.success, true);
  assert.equal(ok.body.data.leadStatus, 'new');
  assert.equal(ok.body.data.customerEmail, 'asha@example.com');
  assert.equal(ok.body.data.customerContactConsent, true);
  assert.ok(!('extra' in ok.body.data) && !('ip' in ok.body.data));

  const dup = await t.call('POST', '/v2/leads/customer', { body: { ...body, customerEmail: 'asha@example.com' } });
  assert.deepEqual([dup.status, dup.body], [200, { success: true, message: 'Lead already submitted recently' }]);
  assert.equal((await t.call('POST', '/v2/leads/customer', { body: { ...body, propertyId: harbour } })).status, 201, 'other property is not a duplicate');
  const general = { ...body, propertyId: undefined, source: 'home_page_contact' };
  assert.equal((await t.call('POST', '/v2/leads/customer', { body: general })).status, 201);
  assert.equal((await t.call('POST', '/v2/leads/customer', { body: general })).status, 200, 'null propertyId is deduplicated too');

  const crm = models.Lead._rows.find((l) => l.phone === '9876501234' && String(l.property) === skyline);
  assert.ok(crm, 'CRM lead created');
  assert.deepEqual(crm.sources, ['form']);
  assert.equal(crm.priority, 'hot');
  assert.equal(String(models.CustomerLead._rows[0].crmLead), String(crm._id));
  assert.ok(models.LeadActivity._rows.some((a) => String(a.lead) === String(crm._id) && /Budget: 1-2 Cr/.test(a.body) && /home loan/.test(a.body)));

  // A known customer's form on a listing they already engaged with joins that lead.
  await t.call('POST', '/v2/leads/customer', { body: { ...body, customerEmail: 'k@x.co', customerPhone: '9822200000', propertyId: harbour } });
  const joined = models.Lead._rows.filter((l) => l.phone === '9822200000' && String(l.property) === harbour);
  assert.equal(joined.length, 1);
  assert.deepEqual([...joined[0].sources].sort(), ['form', 'saved']);
});

test('429 bodies follow the contract per area', async () => {
  let r;
  for (let i = 0; i < 40; i += 1) {
    r = await t.call('GET', '/v2/properties/location-options?q=mum');
    if (r.status === 429) break;
  }
  assert.deepEqual([r.status, r.body], [429, { error: 'Too many search requests — please slow down.' }]);
  for (let i = 0; i < 60; i += 1) {
    r = await t.call('POST', '/v2/leads/customer', { body: {} });
    if (r.status === 429) break;
  }
  assert.deepEqual([r.status, r.body], [429, { success: false, message: 'Too many requests. Please try again later.' }]);
});
