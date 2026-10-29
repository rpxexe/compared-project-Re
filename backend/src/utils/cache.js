const env = require("../config/env");

// Memoises an async loader for `ttlMs`. Concurrent callers during a refresh share one
// in-flight promise, so a traffic spike triggers a single DB query instead of many.
// Per process (each instance keeps its own copy); disabled in tests so fixtures stay fresh.
function cached(ttlMs, load) {
  let value;
  let expiry = 0;
  let pending = null;
  return function get() {
    if (!env.isTest && value !== undefined && Date.now() < expiry) return Promise.resolve(value);
    if (!pending) {
      pending = load()
        .then((v) => {
          value = v;
          expiry = Date.now() + ttlMs;
          return v;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
}

module.exports = { cached };
