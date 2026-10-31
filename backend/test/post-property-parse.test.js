// Verifies the POST /post-property validator accepts what the redesigned form sends.
// Runs without a database; the express/auth modules are stubbed so only parse() is exercised.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'express') return { Router: () => ({ post() {} }) };
  if (/middleware\/auth$/.test(request)) return { authRequired: () => {} };
  if (/controllers\/postProperty-controller$/.test(request)) return { postProperty() {} };
  return realLoad.apply(this, arguments);
};
const { parse } = require('../src/routes/postProperty');
Module._load = realLoad;

const base = { title: 'Nice place', city: 'Mumbai', locality: 'Andheri', price: '35000', area: '950', description: 'A lovely place to live in.' };

test('residential flat needs BHK', () => {
  assert.ok(parse({ ...base, propertyType: 'Flats/Apartments', listingType: 'rent', category: 'residential' }).errors.bhk);
  assert.deepEqual(parse({ ...base, propertyType: 'Flats/Apartments', bhk: '2', listingType: 'rent', category: 'residential' }).errors, {});
});

test('every commercial type is accepted without BHK (Showroom/Industrial/Co-working used to fail)', () => {
  for (const t of ['Office', 'Shop', 'Showroom', 'Warehouse', 'Industrial', 'Commercial Land', 'Co-working Space']) {
    for (const listingType of ['rent', 'sale']) {
      const r = parse({ ...base, propertyType: t, bhk: '', listingType, category: 'commercial' });
      assert.deepEqual(r.errors, {}, `${t}/${listingType}`);
      assert.equal(r.opt.category, 'commercial');
      assert.equal(r.opt.listingType, listingType);
    }
  }
});

test('residential plot needs no BHK; stored purpose/category come from the request', () => {
  const r = parse({ ...base, propertyType: 'Plot', bhk: '', listingType: 'sale', category: 'residential' });
  assert.deepEqual(r.errors, {});
  assert.equal(r.opt.listingType, 'sale');
});

test('full payload from the new form (amenities array, image urls, furnishing, phone)', () => {
  const r = parse({ ...base, propertyType: 'Villa', bhk: '4', listingType: 'sale', category: 'residential', bathrooms: '3', parking: '2 covered', furnishing: 'Semi-furnished', facing: 'East', floor: '2 of 2', possessionStatus: 'Ready to Move', amenities: ['Gym', 'Lift'], images: ['https://img.test/a.jpg'], contactName: 'Asha', contactPhone: '9876543210' });
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.opt.amenities, ['Gym', 'Lift']);
  assert.equal(r.opt.furnishing, 'semi-furnished');
});

test('bad purpose is rejected', () => {
  assert.ok(parse({ ...base, propertyType: 'Villa', bhk: '2', listingType: 'resale' }).errors.listingType);
});

test('total floors and key highlights are kept; bad floor counts are rejected', () => {
  const ok = parse({ ...base, propertyType: 'Villa', bhk: '3', totalFloors: '12', highlights: ['Near Metro', 'Near Metro', 'Park Facing'] });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.opt.totalFloors, 12);
  assert.deepEqual(ok.opt.highlights, ['Near Metro', 'Park Facing']);
  for (const totalFloors of ['0', '2.5', '500', 'ten']) {
    assert.ok(parse({ ...base, propertyType: 'Villa', bhk: '3', totalFloors }).errors.totalFloors, totalFloors);
  }
});
