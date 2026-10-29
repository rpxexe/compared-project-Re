import { orNA, isPresent } from './format.js';

export const COMPARE_MAX = 4;

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
