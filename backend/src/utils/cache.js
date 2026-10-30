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

// Same as cached(), but keeps one entry per key (e.g. per city), dropping the oldest key
// once `maxKeys` is reached so memory stays bounded however many keys are requested.
function cachedByKey(ttlMs, maxKeys, load) {
  const entries = new Map();
  return function get(key) {
    let getter = entries.get(key);
    if (!getter) {
      if (entries.size >= maxKeys) entries.delete(entries.keys().next().value);
      getter = cached(ttlMs, () => load(key));
      entries.set(key, getter);
    }
    return getter();
  };
}

module.exports = { cached, cachedByKey };
