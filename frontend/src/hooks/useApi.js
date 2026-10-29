import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data with loading / error / retry states. Stale responses are ignored.
export function useApi(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error }));
    }
  }, []);

  useEffect(() => { if (enabled) run(); else setState({ data: null, loading: false, error: null }); }, [enabled, run, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: run, refresh: () => run({ silent: true }) };
}
