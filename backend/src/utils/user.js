const publicUser = (u) => ({
  id: String(u._id),
  phone: u.phone || '',
  name: u.name || u.fullName || '',
  fullName: u.fullName || u.name || '',
  email: u.email || '',
  role: u.role || 'user',
  purpose: u.purpose || '',
  city: u.city || '',
});
module.exports = { publicUser };
