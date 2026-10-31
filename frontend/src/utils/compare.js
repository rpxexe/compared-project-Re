import { orNA, isPresent } from './format.js';

export const COMPARE_MAX = 3;

// Row definitions for the side-by-side table. A row is only shown when at least one project has data.
export const COMPARE_ROWS = [
  { key: 'developerName', label: 'Developer' },
  { key: 'location', label: 'Location', get: (p) => [p.locality, p.city].filter(Boolean).join(', ') },
  { key: 'price', label: 'Price', get: (p) => (p.priceMin ? `${p.priceMin} – ${p.price}` : p.price) },
  { key: 'bhk', label: 'BHK', get: (p) => (p.bhk ? `${p.bhk} BHK` : '') },
  { key: 'area', label: 'Area' },
  { key: 'propertyType', label: 'Type' },
  { key: 'possessionStatus', label: 'Possession' },
  { key: 'floor', label: 'Floor', get: (p) => [p.floor, p.totalFloors && `of ${p.totalFloors}`].filter(Boolean).join(' ') },
  { key: 'parkings', label: 'Parking' },
  { key: 'facing', label: 'Facing' },
  { key: 'furnishing', label: 'Furnishing' },
  { key: 'unitsAvailable', label: 'Units available' },
  { key: 'reraNumber', label: 'RERA' },
  { key: 'rating', label: 'Rating', get: (p) => (p.rating ? `${p.rating.average.toFixed(1)} ★ (${p.rating.count})` : '') },
  { key: 'amenities', label: 'Amenities', list: true },
  { key: 'facilities', label: 'Facilities', list: true },
  { key: 'security', label: 'Security', list: true },
];

export function buildCompareTable(items) {
  const rows = [];
  for (const def of COMPARE_ROWS) {
    const values = items.map((p) => (def.get ? def.get(p) : p[def.key]));
    // Keep a row if any project has data; missing values display "N/A" – never invented.
    if (values.some(isPresent)) rows.push({ key: def.key, label: def.label, list: !!def.list, cells: values.map((v) => orNA(v)), raw: values });
  }
  return rows;
}

// Index of the project with the lowest numeric price (only when 2+ projects have a price).
export function lowestPriceIndex(items) {
  const priced = items.map((p, i) => ({ i, v: p.priceValue })).filter((x) => Number.isFinite(x.v) && x.v > 0);
  if (priced.length < 2) return -1;
  return priced.reduce((a, b) => (b.v < a.v ? b : a)).i;
}

// ---- Redesigned compare screen: scored rows, amenity matrix and insights ----
// Scores are parsed from the listing text only; a value that can't be read is left out of the contest.

const numbersIn = (v) => (String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
const maxNumber = (v) => { const n = numbersIn(v); return n.length ? Math.max(...n) : null; };
const positive = (n) => (Number.isFinite(n) && n > 0 ? n : null);

// Area in sq ft, converting the units the listings use. Unknown units are not compared.
export function areaSqft(p) {
  const text = String(p?.area || '');
  const n = numbersIn(text)[0];
  if (!positive(n)) return null;
  if (/sq\.?\s*(m|mt|mtr|metre|meter)s?\b/i.test(text)) return n * 10.764;
  if (/sq\.?\s*(yd|yard)s?\b/i.test(text)) return n * 9;
  if (/acre/i.test(text)) return n * 43560;
  if (/sq\.?\s*(ft|feet)\b|sqft/i.test(text) || !/[a-z]/i.test(text)) return n;
  return null;
}

export function pricePerSqft(p) {
  const price = positive(p?.priceValue);
  const area = areaSqft(p);
  return price && area ? Math.round(price / area) : null;
}

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const isReady = (s) => /ready|immediate|completed/i.test(s || '');

// Indexes holding the best score. Empty when fewer than two projects can be scored or all tie.
export function winners(scores, best = 'max') {
  const valid = scores.map((v, i) => ({ v, i })).filter((x) => Number.isFinite(x.v));
  if (valid.length < 2) return [];
  const pick = best === 'min' ? Math.min(...valid.map((x) => x.v)) : Math.max(...valid.map((x) => x.v));
  if (valid.every((x) => x.v === pick)) return [];
  return valid.filter((x) => x.v === pick).map((x) => x.i);
}

export const KEY_ROWS = [
  { key: 'price', label: 'Price', icon: 'pricetag-outline', get: (p) => (p.priceMin ? `${p.priceMin} – ${p.price}` : p.price), score: (p) => positive(p.priceValue), best: 'min' },
  { key: 'bhk', label: 'BHK', icon: 'home-outline', get: (p) => (p.bhk ? `${p.bhk} BHK` : ''), score: (p) => maxNumber(p.bhk) },
  { key: 'area', label: 'Area', icon: 'resize-outline', score: areaSqft },
  { key: 'propertyType', label: 'Type', icon: 'business-outline' },
  { key: 'possessionStatus', label: 'Possession', icon: 'calendar-outline', score: (p) => (p.possessionStatus ? (isReady(p.possessionStatus) ? 1 : 0) : null) },
  { key: 'furnishing', label: 'Furnishing', icon: 'bed-outline' },
  { key: 'unitsAvailable', label: 'Units Available', icon: 'layers-outline' },
  { key: 'developerName', label: 'Developer', icon: 'construct-outline' },
  { key: 'floor', label: 'Floor', icon: 'stats-chart-outline', get: (p) => [p.floor, p.totalFloors && `of ${p.totalFloors}`].filter(Boolean).join(' ') },
  { key: 'parkings', label: 'Parking', icon: 'car-outline', score: (p) => maxNumber(p.parkings) },
  { key: 'facing', label: 'Facing', icon: 'compass-outline' },
  { key: 'reraNumber', label: 'RERA', icon: 'document-text-outline' },
  { key: 'pricePerSqft', label: 'Price per sq ft', icon: 'bar-chart-outline', get: (p) => { const v = pricePerSqft(p); return v ? inr(v) : ''; }, score: pricePerSqft, best: 'min' },
  { key: 'rating', label: 'Rating', icon: 'star-outline', get: (p) => (p.rating?.count ? `${p.rating.average.toFixed(1)} ★ (${p.rating.count})` : ''), score: (p) => (p.rating?.count ? p.rating.average : null) },
];

export const LOCATION_ROWS = [
  { key: 'locality', label: 'Locality', icon: 'location-outline' },
  { key: 'city', label: 'City', icon: 'business-outline' },
  { key: 'address', label: 'Address', icon: 'map-outline' },
  { key: 'pincode', label: 'Pincode', icon: 'mail-outline' },
  { key: 'mapLink', label: 'Map', icon: 'navigate-outline', link: true },
];

// Same contract as buildCompareTable (rows with no data are hidden), plus the winning columns.
export function buildRows(items, defs) {
  const rows = [];
  for (const def of defs) {
    const values = items.map((p) => (def.get ? def.get(p) : p[def.key]));
    if (!values.some(isPresent)) continue;
    rows.push({
      key: def.key, label: def.label, icon: def.icon, link: !!def.link,
      cells: values.map((v) => orNA(v)), raw: values,
      winners: def.score ? winners(items.map((p) => def.score(p) ?? NaN), def.best) : [],
    });
  }
  return rows;
}

// Every amenity / facility / security feature any project lists, most widely shared first.
export function amenityMatrix(items) {
  const sets = items.map((p) => new Set([...(p.amenities || []), ...(p.facilities || []), ...(p.security || [])].map((a) => a.trim()).filter(Boolean)));
  const names = [...new Set(sets.flatMap((s) => [...s]))];
  const rows = names
    .map((name) => ({ name, has: sets.map((s) => s.has(name)) }))
    .sort((a, b) => b.has.filter(Boolean).length - a.has.filter(Boolean).length || a.name.localeCompare(b.name));
  const counts = sets.map((s) => s.size);
  return { rows, counts, winners: winners(counts) };
}

// Column that wins the most rows; -1 when there is no single leader.
export function overallPick(rows, count) {
  const wins = Array.from({ length: count }, () => 0);
  rows.forEach((r) => r.winners.forEach((i) => { wins[i] += 1; }));
  const top = Math.max(0, ...wins);
  return top > 0 && wins.filter((w) => w === top).length === 1 ? wins.indexOf(top) : -1;
}

// "Why choose?" tiles and the matching card badges. Each comes from a single clear winner.
export function insights(items) {
  const single = (scores, best) => { const w = winners(scores, best); return w.length === 1 ? w[0] : -1; };
  const out = [];
  const price = single(items.map((p) => positive(p.priceValue) ?? NaN), 'min');
  if (price >= 0) out.push({ key: 'price', title: 'Best Price', badge: 'Best Price', index: price, value: items[price].price });
  const space = single(items.map((p) => areaSqft(p) ?? NaN), 'max');
  if (space >= 0) out.push({ key: 'space', title: 'Most Spacious', badge: 'Most Spacious', index: space, value: items[space].area });
  const value = single(items.map((p) => pricePerSqft(p) ?? NaN), 'min');
  if (value >= 0) out.push({ key: 'value', title: 'Best Value', badge: 'Best Value', index: value, value: `${inr(pricePerSqft(items[value]))}/sq ft` });
  const rated = single(items.map((p) => (p.rating?.count ? p.rating.average : NaN)), 'max');
  if (rated >= 0) out.push({ key: 'rating', title: 'Top Rated', badge: 'Top Rated', index: rated, value: `${items[rated].rating.average.toFixed(1)} ★` });
  return out;
}
