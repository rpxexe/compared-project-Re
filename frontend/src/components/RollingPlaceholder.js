import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { brand } from "../theme";
import Text, { AnimatedText } from "./AppText";

// Examples of what the search box really matches (city, locality, project, builder), taken from
// live listings - so a user who types one gets results.
export const SEARCH_HINTS = [
  "cities like “Mumbai”",
  "localities like “Sarjapur Road”",
  "projects like “Joyville”",
  "areas like “Kokapet”",
  "your favourite builder",
];

const LINE = 22;

// Placeholder that rolls through `items` behind a fixed prefix: the current phrase slides up and
// fades out, the next rises in from below. Purely visual (screen readers use the input's label);
// `active` = false freezes it (e.g. while the user is typing or the screen is hidden).
export default function RollingPlaceholder({ prefix = "Search", items = SEARCH_HINTS, active = true, interval = 2800, style }) {
  const [index, setIndex] = useState(0);
  const t = useRef(new Animated.Value(0)).current; // -1 below · 0 shown · 1 above

  useEffect(() => {
    if (!active || items.length < 2) return undefined;
    const id = setInterval(() => {
      if (isReducedMotion()) {
        setIndex((n) => (n + 1) % items.length);
        return;
      }
      Animated.timing(t, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIndex((n) => (n + 1) % items.length);
        t.setValue(-1);
        Animated.timing(t, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
      });
    }, interval);
    return () => clearInterval(id);
  }, [active, items.length, interval]); // eslint-disable-line react-hooks/exhaustive-deps

  const roll = {
    opacity: t.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: t.interpolate({ inputRange: [-1, 0, 1], outputRange: [LINE * 0.8, 0, -LINE * 0.8] }) }],
  };

  return (
    <View style={[styles.row, style]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={styles.prefix} maxFontSizeMultiplier={1.3}>{prefix} </Text>
      <View style={styles.window}>
        <AnimatedText style={[styles.item, roll]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {items[index % items.length]}
        </AnimatedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", overflow: "hidden" },
  prefix: { fontSize: 14.5, lineHeight: LINE, color: brand.placeholder, fontWeight: "500" },
  // Clips the rolling phrase to one line so it appears to rise through a slot.
  window: { flex: 1, height: LINE, overflow: "hidden", justifyContent: "center" },
  item: { fontSize: 14.5, lineHeight: LINE, color: brand.violet, fontWeight: "700" },
});
