const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, SignUpUser } = require('../models');
const { AppError } = require('../utils/errors');
const { isObjectId } = require('../utils/validate');

const JWT_ALG = 'HS256';
const signToken = (user) => jwt.sign({ id: String(user._id) }, env.secret(), { expiresIn: env.jwtExpiresIn, algorithm: JWT_ALG });

async function resolveUser(req) {
  const header = String(req.headers.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, env.secret(), { algorithms: [JWT_ALG] }); } catch { throw new AppError(401, 'Your session has expired. Please log in again.'); }
  if (!isObjectId(payload.id)) throw new AppError(401, 'Invalid session');
  
  let user = await User.findById(payload.id).lean();
  if (!user && SignUpUser) {
    user = await SignUpUser.findById(payload.id).lean();
  }
  if (!user || user.isActive === false) throw new AppError(401, 'Account not available. Please log in again.');
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

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw new AppError(403, 'You do not have permission to do this');
  next();
};

module.exports = { signToken, authRequired, authOptional, requireRole };
