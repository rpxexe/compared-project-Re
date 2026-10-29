const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, models } = require('./helpers/harness');
const seed = require('./seed');

let t;
test.before(async () => { t = await startServer(); });
test.after(() => t.close());

test('empty database: lists return empty arrays, never errors', async () => {
  models.Property.reset();
  const list = await t.call('GET', '/properties');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.items, []);
  assert.equal(list.body.total, 0);
  const cats = await t.call('GET', '/properties/categories');
  assert.equal(cats.status, 200);
  assert.equal(cats.body.counts.projects, 0);
  assert.deepEqual((await t.call('GET', '/properties/top-rated')).body.items, []);
});

test.describe('with data', () => {
  test.before(() => { models.Property.reset(); models.Property.seed(seed); });

  test('GET /properties returns normalized public listings (pending hidden)', async () => {
    const r = await t.call('GET', '/properties');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 4);
    assert.ok(!r.body.items.some((i) => i.title === 'Hidden Pending Listing'));
    const sky = r.body.items.find((i) => i.title === 'Skyline Residency');
    assert.equal(sky.price, '₹1.25 Cr');
    assert.equal(sky.area, '950 sq.ft');
    assert.equal(sky.image, 'https://img.test/a.jpg');
    assert.equal(sky.bhk, '2');
    assert.equal(sky.rating, null, 'no rating is shown until someone rates');
    assert.equal(sky.emi, '', 'EMI is never invented');
  });

  test('normalizer handles variant field names without inventing values', async () => {
    const r = await t.call('GET', '/properties?search=Lakeview');
    const p = r.body.items[0];
    assert.equal(p.title, 'Lakeview Towers');
    assert.equal(p.price, '₹1.5 Cr');
    assert.equal(p.priceMin, '₹80 L');
    assert.equal(p.bhk, '3');
    assert.equal(p.developerName, 'Beta Group');
    assert.equal(p.possessionStatus, 'New Launch');
    assert.equal(p.galleryImages.length, 2);
    assert.equal(p.reraNumber, '');
    assert.deepEqual(p.amenities, []);
  });

  test('search by title, city, locality, developer, type', async () => {
    for (const [q, n] of [['Skyline', 1], ['pune', 1], ['panvel', 1], ['alpha', 2], ['plot', 1], ['zzzz', 0]]) {
      const r = await t.call('GET', `/properties?search=${q}`);
      assert.equal(r.body.total, n, `search=${q}`);
    }
  });

  test('regex metacharacters in search are escaped (no injection / crash)', async () => {
    const r = await t.call('GET', '/properties?search=' + encodeURIComponent('.*(['));
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 0);
    const o = await t.call('GET', '/properties?city[$ne]=x');
    assert.equal(o.status, 200);
  });

  test('filters: city, bhk, price range, type, possession, developer, featured', async () => {
    const q = async (s) => (await t.call('GET', `/properties?${s}`)).body;
    assert.equal((await q('city=Mumbai')).total, 3);
    assert.equal((await q('city=Mumbai&bhk=3')).total, 1);
    assert.equal((await q('bhk=2')).items[0].title, 'Skyline Residency');
    assert.equal((await q('bhk=3')).total, 2);
    assert.equal((await q('minPrice=20000000')).total, 1);
    assert.equal((await q('maxPrice=13000000')).items.some((i) => i.title === 'Skyline Residency'), true);
    assert.equal((await q('propertyType=plot')).total, 1);
    assert.equal((await q('possession=ready')).total, 1);
    assert.equal((await q('developer=alpha')).total, 2);
    assert.equal((await q('featured=true')).total, 1);
    assert.equal((await q('minArea=1000')).total, 1);
  });

  test('sorting + pagination', async () => {
    const asc = (await t.call('GET', '/properties?sort=price_asc&limit=2&page=1')).body;
    assert.equal(asc.items.length, 2);
    assert.equal(asc.pages, 2);
    const page2 = (await t.call('GET', '/properties?limit=2&page=2')).body;
    assert.equal(page2.items.length, 2);
  });

  test('categories only count categories with real data', async () => {
    const { counts } = (await t.call('GET', '/properties/categories')).body;
    assert.equal(counts['new-launch'], 1);
    assert.equal(counts.upcoming, 1);
    assert.equal(counts['under-construction'], 1);
    assert.equal(counts.ready, 1);
    const nl = (await t.call('GET', '/properties?section=new-launch')).body;
    assert.equal(nl.items[0].title, 'Lakeview Towers');
  });

  test('property details, invalid id, missing id, hidden listing', async () => {
    const id = models.Property._rows[0]._id.toString();
    const ok = await t.call('GET', `/properties/${id}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.property.id, id);
    assert.equal((await t.call('GET', '/properties/not-an-id')).status, 400);
    assert.equal((await t.call('GET', `/properties/${t.oid()}`)).status, 404);
    const hidden = models.Property._rows.find((r) => r.approvalStatus === 'pending')._id;
    assert.equal((await t.call('GET', `/properties/${hidden}`)).status, 404);
  });

  test('compare endpoint keeps order, caps at 4 and validates ids', async () => {
    const ids = models.Property._rows.slice(0, 3).map((r) => r._id.toString());
    const r = await t.call('GET', `/properties/compare?ids=${ids[2]},${ids[0]}`);
    assert.deepEqual(r.body.items.map((i) => i.id), [ids[2], ids[0]]);
    assert.equal((await t.call('GET', `/properties/compare?ids=${ids.concat(ids[0].replace(/./, 'a'), ids[1].replace(/./, 'b'), ids[2].replace(/./, 'c')).join(',')}`)).status, 400);
    assert.equal((await t.call('GET', '/properties/compare?ids=xyz')).status, 400);
    assert.deepEqual((await t.call('GET', '/properties/compare')).body.items, []);
  });

  test('facets list real cities and types only', async () => {
    const f = (await t.call('GET', '/properties/facets')).body;
    assert.deepEqual(f.cities, ['Mumbai', 'Pune']);
    assert.ok(f.propertyTypes.includes('Flats/Apartments'));
  });
});
