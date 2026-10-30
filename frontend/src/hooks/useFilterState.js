import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import filtersJson from "../config/filters.json";
import { getContext, parseFilterConfig } from "../utils/filterConfig";
import {
  INTENT_CONTEXT,
  activeFilterCount,
  clear,
  clearAll,
  createFilterState,
  fromQueryParams,
  sameState,
  setContext,
  setQuery,
  setValue,
  toQueryParams,
} from "../utils/filterState";
import { loadDefaultContext, loadFilters, saveFilters } from "../services/filterStorage";

// Parsed once per app run. Swap the import for an API response later; the shape is the same.
export const filterConfig = parseFilterConfig(filtersJson);
if (__DEV__ && filterConfig.errors.length) console.warn("[filters] config problems:\n" + filterConfig.errors.join("\n"));

const DEFAULT_CONTEXT = "buy_residential";

function reducer(s, a) {
  const c = filterConfig;
  switch (a.type) {
    case "replace": return { ready: true, state: a.state };
    case "set": return { ...s, state: setValue(s.state, c, a.id, a.value) };
    case "query": return { ...s, state: setQuery(s.state, c, a.patch) };
    case "clear": return { ...s, state: clear(s.state, c, a.id) };
    case "clearAll": return { ...s, state: clearAll(s.state, c) };
    case "context": return { ...s, state: setContext(s.state, c, a.context) };
    default: return s;
  }
}

// Owns the committed FilterState for a results screen. `initialParams` (route params / deep
// link) win; with none, the last filters used in that context are restored.
export function useFilterState(initialParams) {
  const hasParams = useMemo(
    () => Object.values(initialParams || {}).some((v) => v !== "" && v != null && v !== false),
    [], // eslint-disable-line react-hooks/exhaustive-deps -- first params only, like the old screen
  );
  const [{ ready, state }, dispatch] = useReducer(reducer, null, () => ({
    ready: false,
    state: fromQueryParams(initialParams, filterConfig, DEFAULT_CONTEXT),
  }));

  useEffect(() => {
    let alive = true;
    (async () => {
      const { last, intent } = await loadDefaultContext();
      const fallback = [last, INTENT_CONTEXT[intent], DEFAULT_CONTEXT].find((c) => c && getContext(filterConfig, c)?.id === c);
      let next;
      if (hasParams) next = fromQueryParams(initialParams, filterConfig, fallback);
      else next = fromQueryParams((await loadFilters(fallback)) || { context: fallback }, filterConfig, fallback);
      if (alive) dispatch({ type: "replace", state: next });
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist after the initial restore, skipping the free-text search (it is per-visit).
  const saved = useRef(null);
  useEffect(() => {
    if (!ready) return;
    const { search, ...params } = toQueryParams(state, filterConfig);
    const key = JSON.stringify(params);
    if (saved.current === key) return;
    saved.current = key;
    saveFilters(state.context, params);
  }, [ready, state]);

  const actions = useMemo(() => ({
    replace: (next) => dispatch({ type: "replace", state: next }),
    set: (id, value) => dispatch({ type: "set", id, value }),
    setQuery: (patch) => dispatch({ type: "query", patch }),
    clear: (id) => dispatch({ type: "clear", id }),
    clearAll: () => dispatch({ type: "clearAll" }),
    // Switching context restores what was last used there, keeping the location/search.
    setContext: async (context) => {
      const stored = await loadFilters(context);
      const base = stored ? fromQueryParams(stored, filterConfig, context) : createFilterState(filterConfig, context);
      dispatch({ type: "replace", state: setQuery(base, filterConfig, { search: state.query.search, city: state.query.city, locality: state.query.locality }) });
    },
  }), [state.query.search, state.query.city, state.query.locality]);

  const params = useMemo(() => toQueryParams(state, filterConfig), [state]);
  const count = useMemo(() => activeFilterCount(state, filterConfig), [state]);
  const isSame = useCallback((other) => sameState(other, state), [state]);

  return { ready, state, params, activeCount: count, config: filterConfig, isSame, ...actions };
}
