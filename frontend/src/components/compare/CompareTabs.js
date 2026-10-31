import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { colors, glowSubtle, gradients, radius } from "../../theme";
import Text from "../AppText";

// Pill tabs. Layers: white chips, then the filled pill that springs between them, then the labels,
// whose white copy fades in as the pill passes underneath.
export default function CompareTabs({ tabs, value, onChange }) {
  const [layouts, setLayouts] = useState({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (!placed.current || isReducedMotion()) {
      x.setValue(l.x);
      w.setValue(l.width);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: l.x, speed: 14, bounciness: 7, useNativeDriver: false }),
      Animated.spring(w, { toValue: l.width, speed: 14, bounciness: 7, useNativeDriver: false }),
    ]).start();
  }, [layouts, value, x, w]);

  const ready = tabs.every((t) => layouts[t.key]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {ready
        ? tabs.map((t) => (
            <View key={t.key} pointerEvents="none" style={[styles.chip, { left: layouts[t.key].x, width: layouts[t.key].width }]} />
          ))
        : null}
      {ready ? (
        <Animated.View style={[styles.pill, { left: x, width: w }]} pointerEvents="none">
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {tabs.map((t) => {
        const l = layouts[t.key];
        const lit = l
          ? x.interpolate({ inputRange: [l.x - l.width * 0.6, l.x, l.x + l.width * 0.6], outputRange: [0, 1, 0], extrapolate: "clamp" })
          : t.key === value ? 1 : 0;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            onLayout={(e) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts((s) => (s[t.key]?.x === lx && s[t.key]?.width === width ? s : { ...s, [t.key]: { x: lx, width } }));
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: t.key === value }}
            accessibilityLabel={t.label}
          >
            <Ionicons name={t.icon} size={16} color={colors.ink} />
            <Text style={styles.label}>{t.label}</Text>
            <Animated.View style={[StyleSheet.absoluteFill, styles.tab, { opacity: lit }]} pointerEvents="none">
              <Ionicons name={t.icon} size={16} color={colors.white} />
              <Text style={[styles.label, { color: colors.white }]}>{t.label}</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  chip: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.10)",
  },
  pill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
    ...glowSubtle,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: radius.pill,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.ink },
});
