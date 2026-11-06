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
  // Bumped on every sign-out: uploads queued under an earlier session are dropped, so one
  // person's compare list can never be sent to the next account signed in on this device.
  const sessionGen = useRef(0);
  const prevToken = useRef(token);

  useEffect(() => { readLocal().then(setIds); }, []);

  // Sign-out: forget the list in memory (AuthContext already wiped it from storage).
  useEffect(() => {
    if (prevToken.current && !token) {
      sessionGen.current += 1;
      upload.current = Promise.resolve();
      setIds([]);
    }
    prevToken.current = token;
  }, [token]);

  // On sign-in the server list wins; an empty server list is filled from this device (what was
  // picked as a guest - a previous account's list was cleared at its sign-out).
  useEffect(() => {
    if (!token || !firebasePhone.signedIn()) return undefined;
    let live = true;
    const gen = sessionGen.current;
    (async () => {
      try {
        const local = await readLocal();
        const r = await api.v2.myActivity({ heartLimit: 1 });
        const server = (r.compareProperties || []).map((p) => p._id).slice(0, COMPARE_MAX);
        if (!live || gen !== sessionGen.current) return;
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
    if (firebasePhone.signedIn()) {
      const gen = sessionGen.current;
      upload.current = upload.current
        .then(() => (gen === sessionGen.current ? api.v2.setCompare(next) : null))
        .catch(() => {});
    }
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
