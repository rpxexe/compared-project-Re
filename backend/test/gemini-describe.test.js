// The "Write with AI" description helper: what goes into the prompt, and how replies are tidied.
// No network: generateDescription is only exercised up to its "not configured" check.
const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('../src/config/env');
const { buildPrompt, cleanFacts, tidy, generateDescription } = require('../src/utils/gemini');

test('prompt lists only the details that were filled in', () => {
  const prompt = buildPrompt(cleanFacts({
    listingType: 'rent', category: 'Residential', propertyType: 'Apartment/Flat', bhk: '2', area: '950 Sq.Ft',
    city: 'Pune', locality: 'Baner', floor: '5th Floor', totalFloors: '12', amenities: ['Lift', 'Gymnasium', ''],
    facing: '',
  }));
  assert.match(prompt, /- Purpose: for rent/);
  assert.match(prompt, /- Configuration: 2 BHK/);
  assert.match(prompt, /- Location: Baner, Pune/);
  assert.match(prompt, /- Floor: 5th Floor of 12 floors/);
  assert.match(prompt, /- Amenities: Lift, Gymnasium$/m);
  assert.doesNotMatch(prompt, /Facing/);
  assert.doesNotMatch(prompt, /owner's own draft/);
});

test('an existing draft is passed along to be improved', () => {
  const prompt = buildPrompt(cleanFacts({ propertyType: 'Villa/Independent House', draft: 'Corner plot, east facing garden.' }));
  assert.match(prompt, /owner's own draft[^\n]*\nCorner plot, east facing garden\./);
});

test('fields are length-capped and lists bounded', () => {
  const f = cleanFacts({ city: 'x'.repeat(500), amenities: Array.from({ length: 100 }, (_, i) => `A${i}`) });
  assert.equal(f.city.length, 60);
  assert.equal(f.amenities.length, 40);
});

test('replies lose markdown and stay within the field limit', () => {
  assert.equal(tidy('**Bright** 2 BHK\n\n\n\n# in Baner  \nwith lift'), 'Bright 2 BHK\n\nin Baner\nwith lift');
  assert.equal(tidy('a'.repeat(3000)).length, 2000);
});

test('without a key the feature reports itself unavailable', async () => {
  const saved = env.gemini.apiKey;
  env.gemini.apiKey = '';
  try {
    await assert.rejects(generateDescription({ propertyType: 'Office' }),
      (e) => e.status === 503 && e.expose && e.extra.code === 'AI_NOT_CONFIGURED');
  } finally {
    env.gemini.apiKey = saved;
  }
});

test('copy is aimed at the right readers for each kind of property', () => {
  const { audienceFor } = require('../src/utils/gemini');
  const who = (propertyType, listingType = 'sale') => audienceFor(cleanFacts({ propertyType, listingType }));
  assert.match(who('Apartment/Flat', 'rent'), /families/);
  assert.match(who('Villa/Independent House'), /home buyers/);
  assert.match(who('Plot'), /land/);
  assert.match(who('Office', 'rent'), /office space to lease/);
  assert.match(who('Showroom'), /retail/);
  assert.match(who('Warehouse'), /warehouse/);
});

test('prompt forbids invented facts and stating the price', () => {
  const prompt = buildPrompt(cleanFacts({ propertyType: 'Office', price: '₹1.2 Cr' }));
  assert.match(prompt, /Never invent nearby places/);
  assert.match(prompt, /Do not state the price/);
});
