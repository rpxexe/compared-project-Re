import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brand, colors, radius } from "../../theme";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import Text from "../AppText";

const PAD = 3;

// Equal-width segmented tabs (Buy / Rent / Projects) on the filter screen's violet header.
// A white pill slides under the active tab.
export default function SearchTabs({ tabs, value, onChange }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const index = Math.max(0, tabs.findIndex((t) => t.id === value));
  const seg = width ? (width - PAD * 2) / tabs.length : 0;

  useEffect(() => {
    if (!seg) return;
    const to = index * seg;
    if (!placed.current || isReducedMotion()) {
      placed.current = true;
      x.setValue(to);
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: true, friction: 9, tension: 90 }).start();
  }, [index, seg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: seg, transform: [{ translateX: x }] }]} /> : null}
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={styles.tab}
            // Compact bar to leave room for the filters; hitSlop keeps a full-size touch target.
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            {t.icon ? <Ionicons name={t.icon} size={14} color={on ? brand.violet : colors.white} /> : null}
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PAD,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  thumb: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  tab: { flex: 1, minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  text: { fontSize: 13.5, fontWeight: "700", color: colors.white },
  textOn: { color: brand.violet, fontWeight: "800" },
});
