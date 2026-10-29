import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInr, orNA, timeAgo, formatPhone, formatMobileInput, ratingLabel } from '../src/utils/format.js';
import { phoneError, isValidIndianMobile, otpDigits, validatePost } from '../src/utils/validators.js';
import { normalizeError } from '../src/utils/errors.js';
import { buildCompareTable, lowestPriceIndex, COMPARE_MAX } from '../src/utils/compare.js';

test('formatInr', () => {
  assert.equal(formatInr(12500000), '₹1.25 Cr');
  assert.equal(formatInr(4500000), '₹45 L');
  assert.equal(formatInr(0), '');
  assert.equal(formatInr(null), '');
});

test('orNA never fabricates', () => {
  assert.equal(orNA(''), 'N/A');
  assert.equal(orNA(null), 'N/A');
  assert.equal(orNA([]), 'N/A');
  assert.equal(orNA(['Gym', 'Pool']), 'Gym, Pool');
});

test('phone validation messages', () => {
  assert.equal(phoneError(''), 'Enter your mobile number');
  assert.equal(phoneError('98765'), '5 more digits needed');
  assert.equal(phoneError('987654321'), '1 more digit needed');
  assert.equal(phoneError('98765432101'), 'Mobile number must be exactly 10 digits');
  assert.match(phoneError('5876543210'), /start with 6/);
  assert.equal(phoneError('98765 43210'), '');
  assert.equal(isValidIndianMobile('+91 98765 43210'), false, 'country code must be stripped by the input');
});

test('OTP paste handling', () => {
  assert.deepEqual(otpDigits('123 456'), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(otpDigits('code: 12-34-5678'), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(otpDigits(''), []);
});

test('post-property validation mirrors the server', () => {
  const ok = { title: 'Nice flat', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '2', price: '7,500,000', area: '900', description: 'A lovely home near park' };
  assert.deepEqual(validatePost(ok), {});
  assert.equal(Object.keys(validatePost({})).length >= 6, true);
  assert.equal(validatePost({ ...ok, bhk: '', propertyType: 'Plot' }).bhk, undefined);
  assert.ok(validatePost({ ...ok, images: 'ftp://x' }).images);
  assert.ok(validatePost({ ...ok, contactPhone: '123' }).contactPhone);
});

test('normalizeError: offline, timeout, API message, 5xx', () => {
  assert.equal(normalizeError({}).network, true);
  assert.match(normalizeError({ code: 'ECONNABORTED' }).message, /too long/);
  assert.equal(normalizeError({ response: { status: 401, data: { message: 'Incorrect OTP', code: 'OTP_INVALID' } } }).code, 'OTP_INVALID');
  assert.match(normalizeError({ response: { status: 500, data: {} } }).message, /Something went wrong/);
  assert.deepEqual(normalizeError({ response: { status: 400, data: { message: 'x', errors: { title: 'bad' } } } }).fieldErrors, { title: 'bad' });
});

test('compare table: hides empty rows, shows N/A for gaps, finds the lowest price', () => {
  const a = { id: '1', price: '₹1 Cr', priceValue: 10000000, bhk: '2', amenities: ['Gym'], locality: 'Baner', city: 'Pune' };
  const b = { id: '2', price: '₹80 L', priceValue: 8000000, bhk: '', amenities: [], city: 'Pune' };
  const rows = buildCompareTable([a, b]);
  const keys = rows.map((r) => r.key);
  assert.ok(keys.includes('price') && keys.includes('amenities'));
  assert.ok(!keys.includes('reraNumber'), 'no project has RERA data -> row hidden');
  assert.deepEqual(rows.find((r) => r.key === 'bhk').cells, ['2 BHK', 'N/A']);
  assert.deepEqual(rows.find((r) => r.key === 'amenities').cells, ['Gym', 'N/A']);
  assert.equal(lowestPriceIndex([a, b]), 1);
  assert.equal(lowestPriceIndex([a]), -1);
  assert.equal(COMPARE_MAX, 4);
});

test('misc formatting', () => {
  assert.equal(formatPhone('9876543210'), '+91 98765 43210');
  assert.equal(timeAgo(new Date(Date.now() - 3 * 3600 * 1000)), '3 h ago');
  assert.equal(ratingLabel(null), '');
  assert.equal(ratingLabel({ average: 4.5, count: 12 }), '4.5 (12)');
});

test('formatMobileInput groups partial and full mobile numbers', () => {
  assert.equal(formatMobileInput(''), '');
  assert.equal(formatMobileInput('98765'), '98765');
  assert.equal(formatMobileInput('987654'), '98765 4');
  assert.equal(formatMobileInput('98765 43210'), '98765 43210');
  assert.equal(formatMobileInput('9876543210999'), '98765 43210');
});
