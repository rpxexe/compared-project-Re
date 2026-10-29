export const cleanDigits = (s) => String(s || '').replace(/\D/g, '');
export const isValidIndianMobile = (s) => /^[6-9]\d{9}$/.test(cleanDigits(s));

export function phoneError(s) {
  const d = cleanDigits(s);
  if (!d) return 'Enter your mobile number';
  if (d.length < 10) return `${10 - d.length} more digit${10 - d.length === 1 ? '' : 's'} needed`;
  if (d.length > 10) return 'Mobile number must be exactly 10 digits';
  if (!/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9';
  return '';
}

// Splits pasted text into OTP digits.
export function otpDigits(text, length = 6) {
  return cleanDigits(text).slice(0, length).split('');
}

export function validatePost(f) {
  const e = {};
  if ((f.title || '').trim().length < 3) e.title = 'Enter a property title';
  if (!(f.city || '').trim()) e.city = 'City is required';
  if (!(f.locality || '').trim()) e.locality = 'Locality is required';
  if (!f.propertyType) e.propertyType = 'Select a property type';
  const needsBhk = !/plot|land|commercial|shop|showroom|office|warehouse|industrial|co-?working/i.test(f.propertyType || '');
  if (needsBhk && !f.bhk) e.bhk = 'Select the BHK';
  if (!(Number(String(f.price).replace(/,/g, '')) > 0)) e.price = 'Enter a valid price in ₹';
  if (!(Number(String(f.area).replace(/,/g, '')) > 0)) e.area = 'Enter a valid area in sq.ft';
  if ((f.description || '').trim().length < 10) e.description = 'Add a short description (10+ characters)';
  if (f.contactPhone && !isValidIndianMobile(f.contactPhone)) e.contactPhone = 'Enter a valid 10-digit number';
  const imgs = (f.images || '').split(/[\s,]+/).filter(Boolean);
  if (imgs.some((u) => !/^https?:\/\/\S+$/i.test(u))) e.images = 'Image links must start with http:// or https://';
  return e;
}


export const EMAIL = /^\S+@\S+\.\S+$/;
