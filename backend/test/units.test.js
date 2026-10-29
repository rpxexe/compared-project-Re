const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProperty, formatPrice, numericValue } = require('../src/utils/property');
const { cleanPhone, isValidPhone, escapeRegex, isObjectId } = require('../src/utils/validate');
const { summarise, publicRating } = require('../src/utils/rating');
const { generateOtp, hashOtp, otpMatches } = require('../src/utils/otp');
const { buildPropertyFilter } = require('../src/utils/propertyQuery');
const { matches } = require('./helpers/fakeDb');

test('formatPrice uses Indian units and never fabricates a price', () => {
  assert.equal(formatPrice(5000000), '₹50 L');
  assert.equal(formatPrice(10000000), '₹1 Cr');
  assert.equal(formatPrice(12500000), '₹1.25 Cr');
  assert.equal(formatPrice(null), '');
  assert.equal(formatPrice(''), '');
  assert.equal(formatPrice('Price on request'), 'Price on request');
  assert.equal(numericValue('2.5 Cr'), 25000000);
  assert.equal(numericValue('45 L'), 4500000);
});

test('normalizeProperty is safe on empty / odd documents', () => {
  const p = normalizeProperty({ _id: 'abc' });
  assert.equal(p.title, 'Untitled property');
  assert.equal(p.price, '');
  assert.deepEqual(p.galleryImages, []);
  assert.equal(p.possessionStatus, '', 'no default status is invented');
  assert.doesNotThrow(() => normalizeProperty({ _id: 'x', price: {}, area: [], images: [null, 5, {}], amenities: { a: 1 }, bhk: ['2', '3'] }));
  assert.equal(normalizeProperty({ _id: 'x', images: ['javascript:alert(1)', 'https://ok.test/i.jpg'] }).image, 'https://ok.test/i.jpg');
});

test('title is derived only from real fields', () => {
  assert.equal(normalizeProperty({ _id: 'x', bhk: '2 BHK', propertyType: 'Flats', locality: 'Baner' }).title, '2 BHK Flats in Baner');
});

test('phone helpers', () => {
  assert.equal(cleanPhone('+91 98765-43210'), '9876543210');
  assert.equal(cleanPhone('09876543210'), '9876543210');
  assert.equal(isValidPhone('9876543210'), true);
  assert.equal(isValidPhone('5876543210'), false);
  assert.equal(isValidPhone('98765'), false);
  assert.equal(cleanPhone({ a: 1 }).length >= 0, true);
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
  assert.equal(isObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isObjectId('507f1f77bcf86cd79943901'), false);
});

test('rating summary math', () => {
  assert.deepEqual(summarise([]), { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const s = summarise([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
  assert.equal(s.average, 4.3);
  assert.equal(s.count, 3);
  assert.equal(s.distribution[4], 2);
  assert.equal(publicRating({ count: 0, average: 0 }), null);
  assert.deepEqual(publicRating({ count: 2, average: 4.5 }), { average: 4.5, count: 2 });
});

test('OTP hashing', () => {
  assert.match(generateOtp(), /^\d{6}$/);
  const rec = { codeHash: hashOtp('9876543210', '123456') };
  assert.equal(otpMatches(rec, '9876543210', '123456'), true);
  assert.equal(otpMatches(rec, '9876543210', '654321'), false);
  assert.equal(otpMatches(rec, '9876543211', '123456'), false, 'OTP is bound to the phone number');
  assert.equal(otpMatches(rec, '9876543210', 'abc'), false);
});

test('filter builder: only strings are used, junk input is ignored', () => {
  assert.deepEqual(buildPropertyFilter({}, { includeHidden: true }), {});
  const f = buildPropertyFilter({ search: { $ne: '' }, city: ['a', 'b'], minPrice: 'abc', bhk: '9999', section: 'bogus' });
  assert.equal(JSON.stringify(f).includes('$ne'), false);
  assert.equal(matches({ approvalStatus: 'pending', city: 'X' }, f), false);
});
