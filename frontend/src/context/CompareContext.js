import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPARE_MAX } from '../utils/compare';
import { useToast } from './ToastContext';

const KEY = 'cp_compare_ids';
const CompareContext = createContext(null);
export const useCompare = () => useContext(CompareContext);

export function CompareProvider({ children }) {
  const toast = useToast();
  const [ids, setIds] = useState([]);

  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { try { const a = JSON.parse(v || '[]'); if (Array.isArray(a)) setIds(a.slice(0, COMPARE_MAX)); } catch { /* ignore */ } }).catch(() => {}); }, []);
  const persist = (next) => { setIds(next); AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); };

  const toggle = useCallback((id) => {
    if (ids.includes(id)) { persist(ids.filter((x) => x !== id)); return; }
    if (ids.length >= COMPARE_MAX) { toast.show(`You can compare up to ${COMPARE_MAX} projects`, 'info'); return; }
    persist([...ids, id]);
    toast.show('Added to compare', 'success');
  }, [ids, toast]);

  const value = useMemo(() => ({
    ids, count: ids.length, has: (id) => ids.includes(id), toggle,
    remove: (id) => persist(ids.filter((x) => x !== id)),
    clear: () => persist([]),
    replace: (next) => persist(next.slice(0, COMPARE_MAX)),
    // Drop ids that no longer exist in the database.
    prune: (valid) => { const next = ids.filter((x) => valid.includes(x)); if (next.length !== ids.length) persist(next); },
  }), [ids, toggle]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}
