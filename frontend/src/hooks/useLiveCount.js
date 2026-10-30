import { useEffect, useState } from "react";
import { api } from "../services/api";

// Result count for a set of query params, refreshed while the user edits filters. Waits for
// `delay` ms of no changes, and aborts the previous request whenever the params change, so a
// slow old response can never overwrite a newer one.
export function useLiveCount(params, { enabled = true, delay = 400 } = {}) {
  const [s, setS] = useState({ count: null, loading: false, error: null });
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!enabled) return undefined;
    const ctrl = new AbortController();
    setS((p) => ({ ...p, loading: true, error: null }));
    const t = setTimeout(async () => {
      try {
        const r = await api.propertyCount(JSON.parse(key), { signal: ctrl.signal });
        if (!ctrl.signal.aborted) setS({ count: r.total, loading: false, error: null });
      } catch (error) {
        if (!ctrl.signal.aborted && !error.canceled) setS({ count: null, loading: false, error });
      }
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, enabled, delay]);

  return s;
}

// Counts for "what if I removed this filter?" - used by the empty state to suggest the filters
// that are hiding the most results. `options` is withoutEach() output mapped to params.
export function useRemovalCounts(options, { enabled = true } = {}) {
  const [counts, setCounts] = useState({});
  const key = JSON.stringify((options || []).map((o) => [o.id, o.params]));

  useEffect(() => {
    if (!enabled || !options?.length) { setCounts({}); return undefined; }
    const ctrl = new AbortController();
    Promise.all(
      options.map((o) =>
        api.propertyCount(o.params, { signal: ctrl.signal }).then((r) => [o.id, r.total]).catch(() => [o.id, null]),
      ),
    ).then((pairs) => { if (!ctrl.signal.aborted) setCounts(Object.fromEntries(pairs)); });
    return () => ctrl.abort();
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return counts;
}
