import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SavedContext = createContext(null);
export const useSaved = () => useContext(SavedContext);

export function SavedProvider({ children }) {
  const { token } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState(() => new Set());
  const busy = useRef(new Set());

  useEffect(() => {
    if (!token) { setIds(new Set()); return; }
    api.me().then((r) => setIds(new Set(r.savedIds || []))).catch(() => {});
  }, [token]);

  const toggle = useCallback(async (id) => {
    if (busy.current.has(id)) return;
    busy.current.add(id);
    const want = !ids.has(id);
    setIds((prev) => { const n = new Set(prev); want ? n.add(id) : n.delete(id); return n; }); // optimistic
    try {
      await api.setSaved(id, want);
      toast.show(want ? 'Saved to your list' : 'Removed from saved', 'success');
    } catch (e) {
      setIds((prev) => { const n = new Set(prev); want ? n.delete(id) : n.add(id); return n; }); // roll back
      toast.show(e.message, 'error');
    } finally { busy.current.delete(id); }
  }, [ids, toast]);

  const value = useMemo(() => ({ ids, isSaved: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
