const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const { compute } = require('../src/utils/filterFields');
const { syncFilterFields } = require('../src/utils/filterSync');

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY);

// Shapes taken from the real collection (scraper rows) plus app posts.
const FIXTURES = [
  { title: 'Orchid Heights', city: 'Mumbai', locality: 'Thane West', propertyGroup: 'Residential', propertyType: 'Flats/Apartments', bhk: 2, bathrooms: 2, price: 9500000, area: { value: 1000, unit: 'sqft' }, furnishing: 'Semi-Furnished', possessionStatus: 'Ready To Move', ageOfProperty: '1-5 Years', floor: '6th of 20 Floors', facing: 'East', amenities: ['Gymnasium', 'Lifts', '24x7 Security'], coverImage: { url: 'https://img.test/1.jpg' }, reraApproved: true, reraNumber: 'P5100001', developerName: 'Orchid Group', dataSource: 'scraper', status: 'approved', featured: false, createdAt: ago(3) },
  { title: 'Bay View Residency', city: 'Mumbai', locality: 'Worli', propertyGroup: 'Residential', propertyType: 'Flats/Apartments', bhk: 3, bathrooms: 3, price: 42000000, area: { value: 150, unit: 'sqm' }, furnishing: 'Furnished', possessionStatus: 'Under Construction', ageOfProperty: 'New Property', floor: 18, facing: 'North-East', amenities: ['Swimming Pool', 'Gymnasium', 'Club House'], galleryImages: ['https://img.test/2.jpg'], reraApproved: true, developerName: 'Bay Developers', dataSource: 'scraper', status: 'approved', featured: true, createdAt: '59:33.2' },
  { title: 'Sunrise Villa Estate', city: 'Pune', locality: 'Hinjewadi', propertyGroup: 'Residential', propertyType: 'Villa', bhk: 5, bathrooms: 5, price: 31000000, area: { value: 3200, unit: 'sqft' }, furnishing: 'Unfurnished', possessionStatus: 'New Launch', ageOfProperty: 'New Property', amenities: ['Landscaped Garden', 'Power Backup'], coverImage: { url: 'https://img.test/3.jpg' }, reraApproved: false, reraNumber: 'NA', developerName: 'Sunrise', dataSource: 'scraper', status: 'approved', createdAt: ago(60) },
  { title: 'Cozy 1BHK in Baner', city: 'Pune', locality: 'Sunrise Society, Baner', listingType: 'rent', propertyType: 'Flats/Apartments', bhk: 1, bathrooms: 1, price: 18000, area: { value: 550, unit: 'sqft' }, furnishing: 'Furnished', availability: 'Immediately', amenities: ['Lift'], dataSource: 'manual', ownerRole: 'user', approvalStatus: 'approved', createdAt: ago(2) },
  { title: 'Girls PG Koregaon', city: 'Pune', locality: 'Koregaon Park', listingType: 'rent', propertyType: 'PG/Co-living', price: 9000, dataSource: 'manual', ownerRole: 'broker', approvalStatus: 'approved', createdAt: ago(10) },
  { title: 'Prime Office Tower', city: 'Mumbai', locality: 'BKC', propertyGroup: 'Commercial', propertyType: 'Office Space', price: 65000000, area: { value: 2400, unit: 'sqft' }, furnishing: 'Furnished', possessionStatus: 'Ready To Move', amenities: ['Air Conditioning', 'Cafeteria'], developerName: 'Prime Realty', dataSource: 'scraper', status: 'approved', createdAt: ago(20) },
  { title: 'Shoreline Plot', city: 'Mumbai', locality: 'Alibaug', propertyType: 'Plot', price: 4500000, area: { value: 200, unit: 'sqyd' }, dataSource: 'scraper', developerName: 'Shore', status: 'approved', createdAt: ago(5) },
  { title: 'COMPARE TEST', city: 'Mumbai', locality: 'Worli', propertyType: 'Flats/Apartments', bhk: 2, price: 9000000, dataSource: 'scraper', status: 'pending', createdAt: ago(1) },
  { title: 'Rejected Listing', city: 'Mumbai', locality: 'Worli', propertyType: 'Flats/Apartments', bhk: 2, price: 9000000, dataSource: 'scraper', status: 'rejected', createdAt: ago(1) },
];

test.describe('filterFields normaliser', () => {
  test('maps real document shapes to canonical values', () => {
    const [orchid, bay, villa, rent1, pg, office, plot] = FIXTURES.map((d) => compute(d));
    assert.deepEqual(
      { deal: orchid.deal, segment: orchid.segment, type: orchid.type, bhk: orchid.bhk, furnishing: orchid.furnishing, possession: orchid.possession, age: orchid.age, floor: orchid.floor, facing: orchid.facing, postedBy: orchid.postedBy, rera: orchid.rera, photos: orchid.photos },
      { deal: 'sale', segment: 'residential', type: 'apartment', bhk: 2, furnishing: 'semi', possession: 'ready', age: '1-5', floor: 6, facing: 'east', postedBy: 'builder', rera: true, photos: true },
    );
    assert.deepEqual(orchid.amenities, ['gym', 'security', 'lift']);
    assert.equal(bay.areaSqft, 1615, 'sqm converted to sqft');
    assert.equal(bay.possession, 'under_construction');
    assert.equal(bay.age, 'new');
    assert.equal(bay.facing, 'north-east');
    assert.equal(bay.postedAt, null, 'spreadsheet debris is not a date');
    const withId = compute({ ...FIXTURES[1], _id: '69b91ecc6d9d652adbe534bc9' }); // importer-style id
    assert.deepEqual(withId.postedAt, new Date(0x69b91ecc * 1000), 'falls back to the id timestamp');
    assert.equal(villa.rera, false, 'reraApproved:false / "NA" is not RERA registered');
    assert.equal(villa.photos, true);
    assert.equal(rent1.deal, 'rent');
    assert.equal(rent1.postedBy, 'owner');
    assert.equal(rent1.possession, 'ready', 'rent availability "Immediately" counts as ready');
    assert.deepEqual([pg.type, pg.segment, pg.postedBy, pg.photos], ['pg', 'residential', 'agent', false]);
    assert.deepEqual([office.type, office.segment], ['office', 'commercial']);
    assert.deepEqual([plot.type, plot.segment, plot.areaSqft], ['plot', 'land', 1800]);
    assert.deepEqual(Object.values(compute({ propertyType: 'Industrial Warehouse/Godown' })).slice(2, 4), ['warehouse', 'commercial'], 'warehouse is not a house');
    assert.equal(compute({ propertyType: 'Independent House' }).type, 'independent_house');
    const land = compute({ propertyType: 'Land', propertyGroup: 'Commercial' });
    assert.deepEqual([land.type, land.segment], ['commercial_land', 'commercial']);
  });

  test('missing or junk values stay null instead of being invented', () => {
    const f = compute({ propertyType: 'Flats/Apartments', floor: 'High Floor', ageOfProperty: '', facing: 'Not Specified', bhk: 'abc', createdAt: 'garbage', _id: 'zz' });
    assert.equal(f.floor, null);
    assert.equal(f.age, null);
    assert.equal(f.facing, null);
    assert.equal(f.bhk, null);
    assert.equal(f.price, null);
    assert.equal(f.postedAt, null);
    assert.deepEqual(f.amenities, []);
    assert.equal(compute({ floor: 'Ground Floor' }).floor, 0);
    assert.equal(compute({ floor: 'Aug-20' }).floor, null, 'dates mangled into floor are ignored');
    assert.equal(compute({ bhk: '2 BHK', price: '45 L' }).bhk, 2);
    assert.equal(compute({ price: '45 L' }).price, 4500000);
  });

  test('rent availability buckets', () => {
    const rent = (availability) => compute({ listingType: 'rent', availability }).availableBy;
    assert.equal(rent('Immediately'), 'immediate');
    assert.equal(rent('Within 15 days'), '15d');
    assert.equal(rent('Within 1 month'), '1m');
    assert.equal(rent('After 1 month'), 'later', '"after" wins over the month it mentions');
    assert.equal(compute({ listingType: 'rent', possessionStatus: 'Ready To Move' }).availableBy, 'immediate');
    assert.equal(compute({ availability: 'Immediately' }).availableBy, null, 'only rentals get a move-in bucket');
  });
});

test.describe('filter API', () => {
  let t;
  test.before(async () => {
    t = await startServer();
    models.Property.reset();
    models.Property.seed(FIXTURES);
  });
  test.after(() => t.close());
  const q = async (s) => (await t.call('GET', `/properties?limit=30&${s}`)).body;
  const titles = (r) => r.items.map((i) => i.title).sort();

  test('listings moderated away by the shared "status" field are hidden', async () => {
    const all = await q('');
    assert.equal(all.total, 7);
    assert.ok(!all.items.some((i) => ['COMPARE TEST', 'Rejected Listing'].includes(i.title)));
  });

  test('search contexts slice by deal and segment', async () => {
    assert.deepEqual(titles(await q('context=buy_residential')), ['Bay View Residency', 'Orchid Heights', 'Sunrise Villa Estate']);
    assert.deepEqual(titles(await q('context=rent_residential')), ['Cozy 1BHK in Baner', 'Girls PG Koregaon']);
    assert.deepEqual(titles(await q('context=new_projects')), ['Bay View Residency', 'Sunrise Villa Estate']);
    assert.deepEqual(titles(await q('context=commercial')), ['Prime Office Tower']);
    assert.equal((await q('context=commercial&deal=rent')).total, 0);
    assert.deepEqual(titles(await q('context=plots')), ['Shoreline Plot']);
    assert.equal((await q('context=rent_residential&propertyTypes=pg')).items[0].title, 'Girls PG Koregaon');
  });

  test('multi-select, ranges and units', async () => {
    assert.equal((await q('bhk=1,3')).total, 2);
    assert.equal((await q('bhk=4+')).total, 1);
    assert.equal((await q('bhk=2,5%2B')).total, 2, 'encoded plus works');
    assert.equal((await q('bathrooms=3,4+')).total, 2);
    assert.equal((await q('minPrice=30000000&maxPrice=50000000')).total, 2);
    assert.equal((await q('maxPrice=20000')).total, 2, 'rent budgets');
    assert.equal((await q('furnishing=furnished')).total, 3);
    assert.equal((await q('furnishing=semi,unfurnished')).total, 2);
    assert.equal((await q('possession=ready')).total, 3);
    assert.equal((await q('possession=Under%20Construction')).total, 1, 'legacy label still works');
    assert.equal((await q('postedBy=owner,agent')).total, 2);
    assert.equal((await q('postedBy=builder&context=buy_residential')).total, 3);
    assert.equal((await q('minArea=1500&areaUnit=sqft&context=buy_residential')).total, 2);
    assert.equal((await q('minArea=140&maxArea=160&areaUnit=sqm')).items[0].title, 'Bay View Residency');
    assert.equal((await q('minArea=150&areaUnit=sqyd&context=plots')).total, 1);
    assert.equal((await q('age=new')).total, 2);
    assert.equal((await q('floor=6-10')).items[0].title, 'Orchid Heights');
    assert.equal((await q('floor=ground,11-20')).items[0].title, 'Bay View Residency');
    assert.equal((await q('minFloor=5&maxFloor=10')).items[0].title, 'Orchid Heights');
    assert.equal((await q('minFloor=0&maxFloor=6')).total, 1, 'ground floor bound is valid');
    assert.equal((await q('minFloor=15')).items[0].title, 'Bay View Residency');
    assert.equal((await q('facing=north-east,west')).total, 1);
    assert.equal((await q('amenities=gym')).total, 2);
    assert.equal((await q('amenities=gym,pool')).total, 1, 'amenities must all match');
  });

  test('project name, developer and rent availability', async () => {
    assert.deepEqual(titles(await q('project=bay%20view')), ['Bay View Residency']);
    assert.equal((await q('project=mumbai')).total, 0, 'project matches names only, not the city');
    assert.deepEqual(titles(await q('developer=sunrise')), ['Sunrise Villa Estate']);
    assert.deepEqual(titles(await q('context=rent_residential&availableBy=immediate')), ['Cozy 1BHK in Baner']);
    assert.equal((await q('context=rent_residential&availableBy=15d')).total, 0);
  });

  test('facets list developers', async () => {
    const f = (await t.call('GET', '/properties/facets')).body;
    assert.ok(f.developers.includes('Orchid Group'));
    assert.ok(f.developers.includes('Sunrise'));
  });

  test('toggles and posted since', async () => {
    assert.equal((await q('rera=true')).total, 2);
    assert.equal((await q('withPhotos=true')).total, 3);
    assert.equal((await q('verified=true')).total, 0);
    assert.deepEqual(titles(await q('postedSince=7d&context=rent_residential')), ['Cozy 1BHK in Baner']);
    assert.ok((await q('postedSince=30d')).total >= 4);
  });

  test('unknown or hostile values are ignored, never thrown', async () => {
    for (const s of ['bhk=abc', 'propertyTypes=evil', 'context=nope', 'furnishing[$ne]=x', 'amenities=__proto__', 'floor=99-100', 'postedSince=forever', 'areaUnit=lightyears&minArea=1']) {
      const r = await t.call('GET', `/properties?${s}`);
      assert.equal(r.status, 200, s);
    }
    assert.equal((await q('propertyTypes=evil')).total, 7, 'invalid keys do not filter');
  });

  test('count endpoint matches the list total for the same filters', async () => {
    for (const s of ['', 'context=buy_residential&bhk=2,3', 'context=rent_residential&maxPrice=20000', 'amenities=gym&rera=true', 'search=sunrise']) {
      const [list, count] = await Promise.all([t.call('GET', `/properties?${s}`), t.call('GET', `/properties/count?${s}`)]);
      assert.equal(count.status, 200);
      assert.equal(count.body.total, list.body.total, s);
    }
  });

  test('sorting: newest, price, relevance puts title matches first and paginates across', async () => {
    const newest = await q('sort=newest&context=buy_residential');
    // Bay View's createdAt is debris, so its id timestamp (just now, in the fake DB) is used.
    assert.deepEqual(newest.items.map((i) => i.title), ['Bay View Residency', 'Orchid Heights', 'Sunrise Villa Estate']);
    const asc = await q('sort=price_asc&context=buy_residential');
    assert.deepEqual(asc.items.map((i) => i.title), ['Orchid Heights', 'Sunrise Villa Estate', 'Bay View Residency']);
    const rel = await q('sort=relevance&search=sunrise');
    assert.equal(rel.total, 2);
    assert.equal(rel.items[0].title, 'Sunrise Villa Estate', 'title match first');
    assert.equal(rel.items[1].title, 'Cozy 1BHK in Baner');
    const p1 = (await t.call('GET', '/properties?sort=relevance&search=pune&limit=1&page=1')).body;
    const p2 = (await t.call('GET', '/properties?sort=relevance&search=pune&limit=1&page=2')).body;
    assert.equal(p1.total, 3);
    assert.notEqual(p1.items[0].id, p2.items[0].id);
    const noSearch = await q('sort=relevance');
    assert.equal(noSearch.items[0].title, 'Bay View Residency', 'featured first without a search term');
  });
});

test.describe('filter sync job', () => {
  test('fills missing fields, then only writes changes', async () => {
    models.Property.reset();
    models.Property.seedRaw(FIXTURES.slice(0, 3));
    assert.equal(models.Property._rows[0].filterFields, undefined);
    assert.deepEqual(await syncFilterFields({ dryRun: true }), { scanned: 3, changed: 3 });
    assert.equal(models.Property._rows[0].filterFields, undefined, 'dry run writes nothing');
    assert.deepEqual(await syncFilterFields(), { scanned: 3, changed: 3 });
    assert.equal(models.Property._rows[0].filterFields.bhk, 2);
    assert.deepEqual(await syncFilterFields(), { scanned: 3, changed: 0 }, 'idempotent');
    models.Property._rows[0].price = 12000000; // e.g. the scraper rewrote a listing
    assert.deepEqual(await syncFilterFields(), { scanned: 3, changed: 1 });
    assert.equal(models.Property._rows[0].filterFields.price, 12000000);
  });
});
