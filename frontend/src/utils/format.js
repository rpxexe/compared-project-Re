// Pure helpers (also unit-tested under Node).
export const isPresent = (v) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
export const orNA = (v) => (isPresent(v) ? (Array.isArray(v) ? v.join(', ') : String(v)) : 'N/A');

export function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 10000000) return `₹${+(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${+(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function timeAgo(date, now = Date.now()) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} d ago`;
  const mo = Math.round(d / 30); if (mo < 12) return `${mo} mo ago`;
  return `${Math.round(mo / 12)} y ago`;
}

export const maskPhone = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 2)}••• ••${p.slice(-3)}` : p || '');
// Groups a partially typed 10-digit mobile as "98765 43210" for display in inputs.
export const formatMobileInput = (digits) => {
  const d = String(digits || '').replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
};

export const formatPhone = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p || '');

export function propertyFacts(p) {
  return [
    p.bhk && `${p.bhk} BHK`,
    p.area,
    p.propertyType,
  ].filter(Boolean);
}

export function ratingLabel(r) {
  if (!r || !r.count) return '';
  return `${r.average.toFixed(1)} (${r.count})`;
}
