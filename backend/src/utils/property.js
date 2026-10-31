// Normalises documents from the existing `properties` collection into one predictable shape.
// Rule: never invent data. Missing information stays empty ('' / [] / null) so the app can hide it.

function firstString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function urlOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return /^(https?:)?\/\//i.test(value.trim()) ? value.trim() : '';
  if (Array.isArray(value)) return value.map(urlOf).find(Boolean) || '';
  if (typeof value === 'object') return urlOf(firstString(value.url, value.secure_url, value.src, value.thumbnail, value.path, value.link));
  return '';
}

function urlList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map(urlOf).filter(Boolean))];
}

function numericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = value.replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/);
    if (!m) return null;
    let n = Number(m[0]);
    if (/\bcr(ore)?s?\b/i.test(value)) n *= 10000000;
    else if (/\b(l|lac|lakh|lakhs)\b/i.test(value)) n *= 100000;
    return n;
  }
  if (value && typeof value === 'object') return numericValue(value.max ?? value.value ?? value.amount ?? value.min);
  return null;
}

function formatPrice(value) {
  if (value == null || value === '') return '';
  const n = numericValue(value);
  if (!n) return typeof value === 'string' ? value.trim() : '';
  if (n >= 10000000) return `₹${+(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${+(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatArea(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    const n = numericValue(value);
    const unit = firstString(value.unit) || 'sq.ft';
    return n ? `${n.toLocaleString('en-IN')} ${unit}` : '';
  }
  if (typeof value === 'number') return `${value.toLocaleString('en-IN')} sq.ft`;
  return String(value).trim();
}

function stringList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(arr.map((v) => (typeof v === 'string' ? v.trim() : firstString(v?.name, v?.label, v?.title))).filter(Boolean))];
}

function textOf(v) {
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(', ');
  if (v && typeof v === 'object') return firstString(v.name, v.label, v.value, v.title);
  return firstString(v);
}

function normalizeProperty(doc) {
  const p = doc && doc.toObject ? doc.toObject() : doc || {};
  const loc = p.location && typeof p.location === 'object' ? p.location : {};
  const addr = p.address && typeof p.address === 'object' ? p.address : {};
  const cover = urlOf(p.coverImage) || urlOf(p.image) || urlOf(p.images) || urlOf(p.galleryImages);
  const gallery = [...new Set([cover, ...urlList(p.galleryImages), ...urlList(p.images)].filter(Boolean))];

  const priceRaw = p.price?.max ?? p.price ?? p.amount ?? p.maxPrice;
  const priceMinRaw = p.price?.min ?? p.minPrice;
  const priceValue = numericValue(priceRaw);
  const priceMin = numericValue(priceMinRaw);
  const city = firstString(p.city, loc.city, addr.city);
  const locality = firstString(p.locality, loc.locality, addr.locality, p.areaName);
  const bhk = textOf(p.bhk) || textOf(p.bedrooms) || textOf(p.bedroom);
  const type = firstString(p.propertyType, p.propertyGroup, p.type);
  const bhkNum = bhk.replace(/\s*bhk\s*$/i, '');
  const title = firstString(p.title, p.name, p.projectName) || [bhkNum && `${bhkNum} BHK`, type, (locality || city) && `in ${locality || city}`].filter(Boolean).join(' ') || 'Untitled property';
  const priceText = formatPrice(priceRaw);
  const priceMinText = priceMin && priceValue && priceMin < priceValue ? formatPrice(priceMin) : '';

  return {
    id: String(p._id),
    title,
    city,
    locality,
    address: firstString(typeof p.address === 'string' ? p.address : '', p.fullAddress, addr.line1, addr.street),
    pincode: firstString(p.pincode, addr.pincode),
    mapLink: urlOf(p.mapLink),
    price: priceText,
    priceMin: priceMinText,
    priceValue,
    emi: p.emiStarts != null ? formatPrice(p.emiStarts) : '',
    area: formatArea(p.area ?? p.superBuiltUpArea ?? p.builtUpArea),
    bhk: bhkNum,
    bathrooms: textOf(p.bathrooms) || textOf(p.bathroom),
    balconies: textOf(p.balconies),
    parkings: textOf(p.parkings) || textOf(p.parking),
    facing: textOf(p.facing),
    floor: textOf(p.floor) || textOf(p.floorLabel),
    totalFloors: textOf(p.totalFloors),
    wing: textOf(p.wing),
    ageOfProperty: textOf(p.ageOfProperty),
    buildingGrade: textOf(p.buildingGrade),
    unitsAvailable: textOf(p.unitsAvailable),
    propertyType: type,
    propertyGroup: firstString(p.propertyGroup),
    furnishing: textOf(p.furnishing),
    possessionStatus: firstString(p.possessionStatus, p.possession, p.status),
    developerName: firstString(p.developerName, p.builderName),
    developerAvatar: urlOf(p.developerAvatar),
    description: firstString(p.description),
    longDescription: firstString(p.long_description, p.longDescription),
    amenities: stringList(p.amenities),
    facilities: stringList(p.facilities),
    security: stringList(p.security),
    floorPlans: urlList(p.floorPlans),
    virtualTours: urlList(p.virtualTours),
    brochure: urlOf(p.brochure),
    image: cover,
    galleryImages: gallery,
    sourceUrl: urlOf(p.sourceUrl),
    dataSource: firstString(p.dataSource),
    approvalStatus: firstString(p.approvalStatus),
    featured: p.featured === true,
    reraNumber: firstString(p.reraNumber, p.reraNo),
    createdAt: p.createdAt || null,
    rating: null,
  };
}

module.exports = { normalizeProperty, formatPrice, numericValue, firstString };
