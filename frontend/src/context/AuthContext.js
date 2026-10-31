import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, session, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [pendingWelcome, setPendingWelcome] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState({
    visible: false,
    reason: null, // 'enquiry' | 'post_property' | 'general'
    title: '',
    message: '',
  });

  const signOut = useCallback(async () => {
    await session.clear();
    await AsyncStorage.removeItem('cp_is_guest');
    setTokenState(null);
    setUser(null);
    setIsGuest(false);
    setPendingWelcome(false);
  }, []);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem('cp_is_guest', 'true');
    setIsGuest(true);
  }, []);

  const openLoginPrompt = useCallback(({ reason = 'general', title, message } = {}) => {
    setLoginPrompt({
      visible: true,
      reason,
      title: title || (reason === 'enquiry' ? 'Sign In to Enquire' : reason === 'post_property' ? 'Sign In to Post Property' : 'Sign In Required'),
      message: message || (reason === 'enquiry'
        ? 'Please sign in or create an account to send enquiries directly to developers and verified owners.'
        : reason === 'post_property'
        ? 'Please sign in or register to list your property and reach verified buyers.'
        : 'Sign in to access all features.'),
    });
  }, []);

  const closeLoginPrompt = useCallback(() => {
    setLoginPrompt((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    // A request needed sign-in: drop an expired session, then ask the user to sign in.
    setUnauthorizedHandler(async ({ hadSession } = {}) => {
      if (hadSession) await signOut();
      openLoginPrompt(hadSession
        ? { title: 'Session expired', message: 'Your session has expired. Please sign in again to continue.' }
        : { title: 'Sign In Required', message: 'Please sign in or create an account to continue.' });
    });
    (async () => {
      try {
        const s = await session.load();
        if (s.token && s.user) {
          setTokenState(s.token);
          setUser(s.user);
          setIsGuest(false);
        } else {
          const guestVal = await AsyncStorage.getItem('cp_is_guest');
          if (guestVal === 'true') {
            setIsGuest(true);
          }
        }
        setReady(true);
        if (s.token) {
          try {
            const { user: fresh } = await api.me();
            setUser(fresh);
            session.saveUser(fresh);
          } catch {
            /* offline is fine */
          }
        }
      } catch {
        setReady(true);
      }
    })();
  }, [signOut]);

  const signIn = useCallback(async (newToken, newUser) => {
    await session.save(newToken, newUser);
    await AsyncStorage.removeItem('cp_is_guest');
    setTokenState(newToken);
    setUser(newUser);
    setIsGuest(false);
    setPendingWelcome(true);
    closeLoginPrompt();
  }, [closeLoginPrompt]);

  const updateUser = useCallback(async (next) => {
    setUser(next);
    await session.saveUser(next);
  }, []);

  const value = useMemo(() => ({
    ready,
    token,
    user,
    isGuest,
    pendingWelcome,
    loginPrompt,
    openLoginPrompt,
    closeLoginPrompt,
    continueAsGuest,
    signIn,
    signOut,
    updateUser,
    finishWelcome: () => setPendingWelcome(false),
    isStaff: user?.role === 'admin' || user?.role === 'superadmin',
  }), [ready, token, user, isGuest, pendingWelcome, loginPrompt, openLoginPrompt, closeLoginPrompt, continueAsGuest, signIn, signOut, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
