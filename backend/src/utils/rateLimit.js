const { AppError } = require('./errors');

// Tiny in-memory fixed-window limiter (per process). Good enough for a single Render/Railway
// instance; use a shared store (Redis) if you scale horizontally.
// `key(req)` picks what is limited (default: client IP). Return a falsy key to skip limiting.
function rateLimit({ windowMs, max, message = 'Too many requests. Please try again later.', key = (req) => req.ip || 'unknown' }) {
  const hits = new Map();
  return function limiter(req, res, next) {
    const k = key(req);
    if (!k) return next();
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.reset <= now) hits.set(k, { count: 1, reset: now + windowMs });
    else if (++entry.count > max) {
      // Header only: the app reads a `retryAfterSeconds` body field as "an OTP was just sent".
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return next(new AppError(429, message));
    }
    if (hits.size > 5000) for (const [hk, v] of hits) if (v.reset <= now) hits.delete(hk);
    next();
  };
}
module.exports = { rateLimit };
