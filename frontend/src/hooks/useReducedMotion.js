import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// One shared subscription to the OS "reduce motion" setting, however many components ask.
let current = false;
const listeners = new Set();
let started = false;

function start() {
  if (started) return;
  started = true;
  const set = (v) => {
    current = !!v;
    listeners.forEach((l) => l(current));
  };
  AccessibilityInfo.isReduceMotionEnabled().then(set).catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', set);
}

export function isReducedMotion() {
  start();
  return current;
}

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(current);
  useEffect(() => {
    start();
    listeners.add(setReduced);
    setReduced(current);
    return () => listeners.delete(setReduced);
  }, []);
  return reduced;
}
