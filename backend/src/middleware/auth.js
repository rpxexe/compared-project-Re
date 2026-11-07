const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, SignUpUser } = require('../models');
const { AppError } = require('../utils/errors');
const { isObjectId } = require('../utils/validate');

const JWT_ALG = 'HS256';
// Accounts created before token versions existed have no tokenVersion; they count as 0, so their
// existing sessions keep working until the first logout-all.
const versionOf = (user) => (Number.isInteger(user?.tokenVersion) ? user.tokenVersion : 0);

const signToken = (user) => jwt.sign(
  { id: String(user._id), v: versionOf(user) },
  env.secret(),
  { expiresIn: env.jwtExpiresIn, algorithm: JWT_ALG },
);

// The account a session token belongs to, in either account collection.
async function findAccountById(id) {
  const user = await User.findById(id).lean();
  if (user) return { user, Model: User };
  if (SignUpUser) {
    const signUpUser = await SignUpUser.findById(id).lean();
    if (signUpUser) return { user: signUpUser, Model: SignUpUser };
  }
  return null;
}

async function resolveUser(req) {
  const header = String(req.headers.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, env.secret(), { algorithms: [JWT_ALG] }); } catch { throw new AppError(401, 'Your session has expired. Please log in again.'); }
  if (!isObjectId(payload.id)) throw new AppError(401, 'Invalid session');
  const tokenVersion = payload.v === undefined ? 0 : payload.v;
  if (!Number.isInteger(tokenVersion)) throw new AppError(401, 'Invalid session');

  const found = await findAccountById(payload.id);
  const user = found?.user;
  if (!user || user.isActive === false) throw new AppError(401, 'Account not available. Please log in again.');
  // Signed out everywhere (or revoked by an admin) since this token was issued.
  if (tokenVersion !== versionOf(user)) throw new AppError(401, 'Your session has expired. Please log in again.');
  return {
    id: String(user._id),
    phone: user.phone || '',
    name: user.name || user.fullName || '',
    role: user.role || 'user', // least privilege if a record has no role
  };
}

async function authRequired(req, res, next) {
  const user = await resolveUser(req);
  if (!user) throw new AppError(401, 'Authentication required');
  req.user = user;
  next();
}

async function authOptional(req, res, next) {
  try { req.user = await resolveUser(req); } catch { req.user = null; }
  next();
}

module.exports = { signToken, authRequired, authOptional, findAccountById };
