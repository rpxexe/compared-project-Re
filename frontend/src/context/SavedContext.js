import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import * as firebasePhone from '../services/firebasePhone';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { navigationRef } from '../navigation/navigationRef';

// Opens the wishlist from wherever the heart was tapped; Saved is in every tab's stack.
const openSaved = () => { if (navigationRef.isReady()) navigationRef.navigate('Saved'); };

const SavedContext = createContext(null);
export const useSaved = () => useContext(SavedContext);

export function SavedProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState(() => new Set());
  const busy = useRef(new Set());

  // Signed in with Firebase: hearts go through /api/v2 (the same list on the server); sessions
  // from the backend's own OTP keep using the v1 save endpoints.
  useEffect(() => {
    if (!token) { setIds(new Set()); return; }
    const load = firebasePhone.signedIn()
      ? api.v2.myActivity({ heartLimit: 1 }).then((r) => r.heartedIds)
      : api.me().then((r) => r.savedIds);
    load.then((list) => setIds(new Set(list || []))).catch(() => {});
  }, [token]);

  const toggle = useCallback(async (id) => {
    if (busy.current.has(id)) return;
    busy.current.add(id);
    const want = !ids.has(id);
    setIds((prev) => { const n = new Set(prev); want ? n.add(id) : n.delete(id); return n; }); // optimistic
    try {
      if (firebasePhone.signedIn()) {
        // toggle-heart flips the server state; the returned list is the truth either way.
        const r = await api.v2.toggleHeart(id);
        setIds(new Set(r.heartedIds || []));
        if (r.isHearted !== want) return;
      } else {
        await api.setSaved(id, want);
      }
      toast.show(
        want ? 'Saved to your wishlist' : 'Removed from saved',
        'success',
        want ? { action: { label: 'View', onPress: openSaved } } : undefined,
      );
    } catch (e) {
      setIds((prev) => { const n = new Set(prev); want ? n.delete(id) : n.add(id); return n; }); // roll back
      toast.show(e.message, 'error');
    } finally { busy.current.delete(id); }
  }, [ids, toast]);

  const value = useMemo(() => ({ ids, isSaved: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
