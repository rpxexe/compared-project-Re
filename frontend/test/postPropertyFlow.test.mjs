import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS, EMPTY_FORM, LISTING_OPTIONS, CATEGORY_OPTIONS, RESIDENTIAL_TYPES, COMMERCIAL_TYPES,
  validateStep, firstInvalidStep, buildPayload, needsBhk, sanitizeForType, typesFor,
} from '../src/utils/postPropertyFlow.js';

const ok = (over = {}) => ({
  ...EMPTY_FORM, title: 'Bright home', propertyType: 'Flats/Apartments', city: 'Mumbai', locality: 'Andheri West',
  bhk: '2', area: '950', price: '35000', description: 'A bright, airy home near the metro.', ...over,
});

test('selection options: exactly Rent/Resale and Residential/Commercial; Resale maps to backend value "sale"', () => {
  assert.deepEqual(LISTING_OPTIONS.map((o) => o.label), ['Rent', 'Resale']);
  assert.deepEqual(LISTING_OPTIONS.map((o) => o.value), ['rent', 'sale']);
  assert.deepEqual(CATEGORY_OPTIONS.map((o) => o.label), ['Residential', 'Commercial']);
});

test('form is 7 steps and the earlier selections are never a step or a field', () => {
  assert.equal(STEPS.length, 7);
  assert.ok(!('listingType' in EMPTY_FORM) && !('category' in EMPTY_FORM));
});

test('property types follow the chosen category', () => {
  assert.deepEqual(typesFor('residential'), RESIDENTIAL_TYPES);
  assert.deepEqual(typesFor('commercial'), COMMERCIAL_TYPES);
});

test('a step does not validate until its required fields are valid', () => {
  const c = { listingType: 'rent', category: 'residential' };
  assert.ok(validateStep('basics', EMPTY_FORM, c).title);
  assert.ok(validateStep('basics', { ...EMPTY_FORM, title: 'abc', propertyType: 'Office' }, c).propertyType, 'commercial type invalid for residential');
  assert.deepEqual(validateStep('basics', ok(), c), {});
  assert.ok(validateStep('location', ok({ city: '' }), c).city);
  assert.ok(validateStep('specs', ok({ bhk: '' }), c).bhk);
  assert.ok(validateStep('specs', ok({ area: '0' }), c).area);
  assert.ok(validateStep('pricing', ok({ price: '' }), c).price);
  assert.ok(validateStep('review', ok({ description: 'short' }), c).description);
  assert.ok(validateStep('review', ok({ contactPhone: '12345' }), c).contactPhone);
  assert.ok(validateStep('photos', ok({ images: ['ftp://x'] }), c).images);
});

test('BHK only for residential non-plot types', () => {
  assert.equal(needsBhk('residential', 'Villa'), true);
  assert.equal(needsBhk('residential', 'Plot'), false);
  assert.equal(needsBhk('commercial', 'Office'), false);
  const c = { listingType: 'sale', category: 'commercial' };
  assert.deepEqual(validateStep('specs', ok({ propertyType: 'Showroom', bhk: '' }), c), {});
});

test('changing type drops fields that no longer apply', () => {
  const f = sanitizeForType(ok({ propertyType: 'Plot', bathrooms: '2', furnishing: 'Furnished', floor: '3' }), 'residential');
  assert.equal(f.bhk, ''); assert.equal(f.bathrooms, ''); assert.equal(f.furnishing, ''); assert.equal(f.floor, '');
});

test('payload carries purpose + category from the earlier steps for all four combinations', () => {
  for (const listingType of ['rent', 'sale']) {
    for (const category of ['residential', 'commercial']) {
      const type = typesFor(category)[0];
      const f = ok({ propertyType: type, bhk: needsBhk(category, type) ? '3' : '' });
      assert.equal(firstInvalidStep(f, { listingType, category }), null);
      const p = buildPayload(f, { listingType, category });
      assert.equal(p.listingType, listingType);
      assert.equal(p.category, category);
      assert.equal(p.price, '35000');
      assert.equal(p.area, '950');
    }
  }
});

test('commercial payload never sends BHK; optional fields are omitted when empty', () => {
  const p = buildPayload(ok({ propertyType: 'Shop', bhk: '4' }), { listingType: 'rent', category: 'commercial' });
  assert.equal(p.bhk, '');
  for (const k of ['facing', 'amenities', 'images', 'contactPhone', 'contactName', 'parking', 'furnishing']) assert.ok(!(k in p), k);
});

test('firstInvalidStep points at the earliest broken step', () => {
  const r = firstInvalidStep(ok({ city: '', price: '' }), { listingType: 'rent', category: 'residential' });
  assert.equal(r.stepIndex, 1);
});
