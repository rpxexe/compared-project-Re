import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { brand, motion } from "../theme";
import { isReducedMotion } from "../hooks/useReducedMotion";

const W = 50;
const H = 30;
const KNOB = 24;

// Pill switch in the brand violet. `value` must reflect real state (e.g. the OS permission),
// never an optimistic guess.
export default function Toggle({ value, onPress, disabled, accessibilityLabel, accessibilityHint }) {
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (isReducedMotion()) {
      v.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(v, {
      toValue: value ? 1 : 0,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // background colour can't use the native driver
    }).start();
  }, [value, v]);

  const bg = v.interpolate({ inputRange: [0, 1], outputRange: ["#DAD3EA", brand.violet] });
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [3, W - KNOB - 3] });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, justifyContent: "center" },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#17133B",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
