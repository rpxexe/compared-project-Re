const { AppError } = require('./errors');

// Tiny in-memory fixed-window limiter (per process). Good enough for a single Render/Railway
// instance; use a shared store (Redis) if you scale horizontally.
// `key(req)` picks what is limited (default: client IP). Return a falsy key to skip limiting.
// `body` sends that exact JSON with the 429 instead of the usual { message } error.
// `maxKeys` bounds memory: past it, expired windows are dropped and then the oldest keys are
// evicted, so a flood of distinct keys (spoofed IPs, random emails) can't grow the map forever.
function rateLimit({
  windowMs, max, message = 'Too many requests. Please try again later.',
  key = (req) => req.ip || 'unknown', body, maxKeys = 10000,
}) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < maxKeys) return;
    for (const [hk, v] of hits) if (v.reset <= now) hits.delete(hk);
    // Map iteration is insertion order and every new window re-inserts its key, so the
    // first keys are the oldest windows.
    for (const hk of hits.keys()) {
      if (hits.size < maxKeys) break;
      hits.delete(hk);
    }
  }

  function limiter(req, res, next) {
    const k = key(req);
    if (!k) return next();
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      if (entry) hits.delete(k);
      else prune(now);
      hits.set(k, { count: 1, reset: now + windowMs });
    } else if (++entry.count > max) {
      // Retry-After goes in the header only; the body keeps the usual error shape.
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      if (body) return res.status(429).json(body);
      return next(new AppError(429, message));
    }
    next();
  }
  limiter.size = () => hits.size;
  limiter.reset = () => hits.clear();
  return limiter;
}

// Limits by signed-in user (falls back to IP); put it after the auth middleware.
const byUser = (req) => (req.user?.id ? `u:${req.user.id}` : req.ip || 'unknown');

module.exports = { rateLimit, byUser };
