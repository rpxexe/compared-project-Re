import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS, EMPTY_FORM, LISTING_OPTIONS, CATEGORY_OPTIONS, RESIDENTIAL_TYPES, COMMERCIAL_TYPES,
  validateStep, firstInvalidStep, buildPayload, needsBhk, sanitizeForType, typesFor,
  FLOORS, TOP_FLOOR, floorLabel, formFromListing,
} from '../src/utils/postPropertyFlow.js';

const ok = (over = {}) => ({
  ...EMPTY_FORM, listingType: 'rent', category: 'residential', propertyType: 'Flats/Apartments',
  city: 'Mumbai', locality: 'Andheri West', bhk: '2', area: '950', price: '35000',
  description: 'A bright, airy home near the metro.', cover: { url: 'https://img.example/cover.jpg' }, agreed: true, ...over,
});

test('selection options: exactly Sell/Rent and Residential/Commercial; Sell maps to backend value "sale"', () => {
  assert.deepEqual(LISTING_OPTIONS.map((o) => o.label), ['Sell', 'Rent']);
  assert.deepEqual(LISTING_OPTIONS.map((o) => o.value), ['sale', 'rent']);
  assert.deepEqual(CATEGORY_OPTIONS.map((o) => o.label), ['Residential', 'Commercial']);
});

test('form is 4 steps, and purpose + category are chosen on the first one', () => {
  assert.deepEqual(STEPS.map((s) => s.key), ['purpose', 'amenities', 'details', 'review']);
  assert.ok('listingType' in EMPTY_FORM && 'category' in EMPTY_FORM);
});

test('property types follow the chosen category', () => {
  assert.deepEqual(typesFor('residential'), RESIDENTIAL_TYPES);
  assert.deepEqual(typesFor('commercial'), COMMERCIAL_TYPES);
});

test('floors run Ground, 1-59, then "60 & higher"', () => {
  assert.deepEqual([FLOORS[0], FLOORS[59], FLOORS.at(-1), FLOORS.length], ['Ground', '59', TOP_FLOOR, 61]);
  assert.ok(!FLOORS.includes('60'), 'no plain 60th floor');
  assert.equal(floorLabel(TOP_FLOOR), '60 & higher');
  assert.equal(buildPayload(ok({ totalFloors: '75', floor: TOP_FLOOR })).floor, '60th Floor & above', 'backend reads its leading number');
  assert.ok(validateStep('purpose', ok({ totalFloors: '40', floor: TOP_FLOOR })).floor, 'above a 40-floor building');
  assert.deepEqual(validateStep('purpose', ok({ totalFloors: '75', floor: TOP_FLOOR })), {});
  assert.equal(formFromListing({ floor: '60th Floor & above' }).floor, TOP_FLOOR, 'round-trips for editing');
  assert.equal(formFromListing({ floor: '72nd Floor' }).floor, TOP_FLOOR, 'older high floors land on it too');
});

test('a step does not validate until its required fields are valid', () => {
  const empty = validateStep('purpose', EMPTY_FORM);
  for (const k of ['listingType', 'category', 'propertyType', 'city', 'locality', 'area', 'price']) assert.ok(empty[k], k);
  assert.ok(validateStep('purpose', ok({ propertyType: 'Office' })).propertyType, 'commercial type invalid for residential');
  assert.deepEqual(validateStep('purpose', ok()), {});
  assert.ok(validateStep('purpose', ok({ city: '' })).city);
  assert.ok(validateStep('purpose', ok({ bhk: '' })).bhk);
  assert.ok(validateStep('purpose', ok({ area: '0' })).area);
  assert.ok(validateStep('purpose', ok({ price: '' })).price);
  assert.ok(validateStep('purpose', ok({ totalFloors: '5', floor: '9' })).floor);
  assert.ok(validateStep('purpose', ok({ availability: 'Custom date', availableDate: '31/02/2030' })).availableDate);
  assert.deepEqual(validateStep('amenities', ok()), {}, 'amenities are optional');
  assert.ok(validateStep('details', ok({ description: 'short' })).description);
  assert.ok(validateStep('details', ok({ cover: null })).cover);
  assert.ok(validateStep('review', ok({ agreed: false })).agreed);
});

test('BHK only for residential non-plot types', () => {
  assert.equal(needsBhk('residential', 'Villa/Independent House'), true);
  assert.equal(needsBhk('residential', 'Plot'), false);
  assert.equal(needsBhk('commercial', 'Office'), false);
  assert.deepEqual(validateStep('purpose', ok({ listingType: 'sale', category: 'commercial', propertyType: 'Showroom', bhk: '' })), {});
});

test('changing type drops fields that no longer apply', () => {
  const f = sanitizeForType(ok({ propertyType: 'Plot', bathrooms: '2', furnishing: 'Furnished', floor: '3' }));
  assert.equal(f.bhk, ''); assert.equal(f.bathrooms, ''); assert.equal(f.furnishing, ''); assert.equal(f.floor, '');
});

test('payload carries purpose + category for all four combinations', () => {
  for (const listingType of ['rent', 'sale']) {
    for (const category of ['residential', 'commercial']) {
      const type = typesFor(category)[0];
      const f = ok({ listingType, category, propertyType: type, bhk: needsBhk(category, type) ? '3' : '' });
      assert.equal(firstInvalidStep(f), null);
      const p = buildPayload(f);
      assert.equal(p.listingType, listingType);
      assert.equal(p.category, category);
      assert.equal(p.price, '35000');
      assert.equal(p.area, '950');
    }
  }
});

test('commercial payload never sends BHK; optional fields are omitted when empty', () => {
  const p = buildPayload(ok({ category: 'commercial', propertyType: 'Shop', bhk: '4', cover: null }));
  assert.equal(p.bhk, '');
  for (const k of ['facing', 'amenities', 'images', 'parking', 'furnishing']) assert.ok(!(k in p), k);
});

test('firstInvalidStep points at the earliest broken step', () => {
  assert.equal(firstInvalidStep(ok({ city: '', description: '' })).stepIndex, 0);
  assert.equal(firstInvalidStep(ok({ description: '' })).stepIndex, 2);
  assert.equal(firstInvalidStep(ok({ agreed: false })).stepIndex, 3);
});
