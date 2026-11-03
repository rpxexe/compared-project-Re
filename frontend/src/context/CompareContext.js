import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPARE_MAX } from '../utils/compare';
import { api } from '../services/api';
import * as firebasePhone from '../services/firebasePhone';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const KEY = 'cp_compare_ids';
const CompareContext = createContext(null);
export const useCompare = () => useContext(CompareContext);

const readLocal = async () => {
  try {
    const a = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
    return Array.isArray(a) ? a.slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
};
const saveLocal = (ids) => AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});

// The compare list lives on the device. Signed in with Firebase, it is also kept on the server
// (PUT /v2/customerActivity/compare, a full replace), so it follows the customer across devices.
export function CompareProvider({ children }) {
  const toast = useToast();
  const { token } = useAuth();
  const [ids, setIds] = useState([]);
  const upload = useRef(Promise.resolve());

  useEffect(() => { readLocal().then(setIds); }, []);

  // On sign-in the server list wins; an empty server list is filled from this device.
  useEffect(() => {
    if (!token || !firebasePhone.signedIn()) return undefined;
    let live = true;
    (async () => {
      try {
        const local = await readLocal();
        const r = await api.v2.myActivity({ heartLimit: 1 });
        const server = (r.compareProperties || []).map((p) => p._id).slice(0, COMPARE_MAX);
        if (!live) return;
        if (server.length) {
          setIds(server);
          saveLocal(server);
        } else if (local.length) {
          await api.v2.setCompare(local);
        }
      } catch { /* offline: keep the device list */ }
    })();
    return () => { live = false; };
  }, [token]);

  const persist = useCallback((next) => {
    setIds(next);
    saveLocal(next);
    // Uploads run one after another so a quick double tap can't land out of order.
    if (firebasePhone.signedIn()) upload.current = upload.current.then(() => api.v2.setCompare(next)).catch(() => {});
  }, []);

  const toggle = useCallback((id) => {
    if (ids.includes(id)) { persist(ids.filter((x) => x !== id)); return; }
    if (ids.length >= COMPARE_MAX) { toast.show(`You can compare up to ${COMPARE_MAX} projects`, 'info'); return; }
    persist([...ids, id]);
    toast.show('Added to compare', 'success');
  }, [ids, toast, persist]);

  const value = useMemo(() => ({
    ids, count: ids.length, has: (id) => ids.includes(id), toggle,
    remove: (id) => persist(ids.filter((x) => x !== id)),
    clear: () => persist([]),
    replace: (next) => persist(next.slice(0, COMPARE_MAX)),
    // Drop ids that no longer exist in the database.
    prune: (valid) => { const next = ids.filter((x) => valid.includes(x)); if (next.length !== ids.length) persist(next); },
  }), [ids, toggle, persist]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}
