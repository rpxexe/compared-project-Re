import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { brand, colors, radius } from "../../theme";
import Text from "../AppText";

// Scrollable listing-type tabs for the results screen's violet header (Buy, Rent / PG, Projects,
// Commercial, Plots). A white pill springs to the active tab and its violet label fades in as the
// pill passes underneath; the row scrolls to keep the active tab in view.
export default function ContextTabs({ tabs, value, onChange }) {
  const [layouts, setLayouts] = useState({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const scroller = useRef(null);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    scroller.current?.scrollTo({ x: Math.max(0, l.x - 48), animated: placed.current });
    if (!placed.current || isReducedMotion()) {
      x.setValue(l.x);
      w.setValue(l.width);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: l.x, speed: 14, bounciness: 6, useNativeDriver: false }),
      Animated.spring(w, { toValue: l.width, speed: 14, bounciness: 6, useNativeDriver: false }),
    ]).start();
  }, [layouts, value, x, w]);

  const ready = tabs.every((t) => layouts[t.id]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {ready ? (
        <Animated.View style={[styles.pill, { left: x, width: w }]} pointerEvents="none" />
      ) : null}
      {tabs.map((t) => {
        const l = layouts[t.id];
        const on = t.id === value;
        const lit = l
          ? x.interpolate({ inputRange: [l.x - l.width * 0.6, l.x, l.x + l.width * 0.6], outputRange: [0, 1, 0], extrapolate: "clamp" })
          : on ? 1 : 0;
        return (
          <Pressable
            key={t.id}
            onPress={() => !on && onChange(t.id)}
            onLayout={(e) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts((s) => (s[t.id]?.x === lx && s[t.id]?.width === width ? s : { ...s, [t.id]: { x: lx, width } }));
            }}
            style={[styles.tab, styles.chip, !ready && on && styles.tabOnFallback]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.label} listings`}
          >
            {t.icon ? <Ionicons name={t.icon} size={15} color={colors.white} /> : null}
            <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>{t.label}</Text>
            <Animated.View style={[StyleSheet.absoluteFill, styles.tab, { opacity: lit }]} pointerEvents="none">
              {t.icon ? <Ionicons name={t.icon} size={15} color={brand.violet} /> : null}
              <Text style={[styles.label, styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{t.label}</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 6 },
  pill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    shadowColor: brand.deep,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radius.pill,
  },
  chip: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
  // Before layouts are measured, show the active tab with a plain white fill so it never flickers.
  tabOnFallback: { backgroundColor: colors.white },
  label: { fontSize: 13.5, fontWeight: "700", color: colors.white },
  labelOn: { color: brand.violet, fontWeight: "800" },
});
