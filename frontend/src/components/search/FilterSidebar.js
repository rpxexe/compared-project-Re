import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brand, colors } from "../../theme";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import Text from "../AppText";

const ITEM_H = 54;
const INSET = 5; // gap between the selection pill and its row's edges

// Vertical list of filter categories for the active tab: icon + one-line label per row, hairline
// separators, a highlight that slides to the selected row, and rows that fade in one by one when
// the tab (`animKey`) changes. `counts` puts a dot on categories that hold selections.
export default function FilterSidebar({ categories, value, counts, onSelect, width, animKey }) {
  const index = Math.max(0, categories.findIndex((c) => c.id === value));
  const y = useRef(new Animated.Value(index * ITEM_H)).current;
  // Rows start hidden (unless motion is reduced) so the stagger below never flashes them first.
  const rows = useMemo(() => categories.map(() => new Animated.Value(isReducedMotion() ? 1 : 0)), [categories]);

  useEffect(() => {
    if (isReducedMotion()) {
      y.setValue(index * ITEM_H);
      return;
    }
    Animated.spring(y, { toValue: index * ITEM_H, useNativeDriver: true, friction: 9, tension: 110 }).start();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isReducedMotion()) return;
    rows.forEach((v) => v.setValue(0));
    Animated.stagger(
      35,
      rows.map((v) => Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: true })),
    ).start();
  }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.root, { width }]}>
      {/* "handled": with the search field focused, the first tap still picks a category. */}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View>
          <Animated.View pointerEvents="none" style={[styles.highlight, { transform: [{ translateY: y }] }]}>
            <View style={styles.bar} />
          </Animated.View>
          {categories.map((c, i) => {
            const on = c.id === value;
            const n = counts[c.id] || 0;
            return (
              <Animated.View
                key={c.id}
                style={{
                  opacity: rows[i],
                  transform: [{ translateX: rows[i].interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
                }}
              >
                <Pressable
                  onPress={() => onSelect(c.id)}
                  style={styles.item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={n ? `${c.label}, ${n} selected` : c.label}
                >
                  {({ pressed }) => (
                    <>
                      {pressed && !on ? <View style={styles.pressTint} /> : null}
                      <View>
                        <Ionicons name={c.icon || "funnel-outline"} size={18} color={on ? brand.violet : colors.muted} />
                        {n ? <View style={styles.dot} /> : null}
                      </View>
                      <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                        {c.short || c.label}
                      </Text>
                    </>
                  )}
                </Pressable>
                {/* No separator touching the selected pill. */}
                {i < categories.length - 1 && i !== index && i + 1 !== index ? <View style={styles.sep} /> : null}
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: brand.lavender, paddingTop: 6 },
  // Rounded pill inset inside its row, so the selection floats instead of filling a rectangle.
  highlight: {
    position: "absolute",
    top: INSET,
    left: 8,
    right: 8,
    height: ITEM_H - INSET * 2,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: brand.deep,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bar: { position: "absolute", left: 6, top: 13, bottom: 13, width: 4, borderRadius: 2, backgroundColor: brand.violet },
  item: { height: ITEM_H, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 22, paddingRight: 12 },
  pressTint: { position: "absolute", top: INSET, bottom: INSET, left: 8, right: 8, borderRadius: 14, backgroundColor: "rgba(124, 44, 245, 0.08)" },
  sep: { position: "absolute", left: 22, right: 20, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(124, 44, 245, 0.18)" },
  dot: { position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: brand.magenta, borderWidth: 1.5, borderColor: colors.white },
  label: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.muted },
  labelOn: { color: brand.ink, fontWeight: "800" },
});
