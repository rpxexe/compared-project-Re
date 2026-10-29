import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { isReducedMotion } from './useReducedMotion';

// Fade + rise entrance. Returns an animated style; `delay` staggers siblings.
// With "reduce motion" on, content appears in place immediately.
export function useEntrance(delay = 0, distance = 18) {
  const v = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (isReducedMotion()) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };
}

// Gentle breathing/pulse animation for badges, active states, and focus rings
export function usePulse(min = 0.94, max = 1.04, duration = 1800) {
  const scale = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: max,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: min,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, min, max, duration]);

  return scale;
}

// Smooth floating hover effect for decorative elements, badges, and hero cards
export function useFloat(distance = 6, duration = 2400) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: -distance,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [y, distance, duration]);

  return { transform: [{ translateY: y }] };
}
