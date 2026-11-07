import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FilterControl from "../filters/FilterControl";
import LocationFilter from "./LocationFilter";
import DeveloperFilter from "./DeveloperFilter";
import ProjectFilter from "./ProjectFilter";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radius } from "../../theme";
import Text from "../AppText";
import { Skeleton, SkeletonText } from "../StateViews";

// The selected sidebar category's controls. What to draw comes from the category's config
// entry: a special `panel`, or its config filters drawn by the shared FilterControl.
// `transitionKey` (tab + category) replays a short fade/slide when either changes.
// Loading placeholder: the category title row with its divider, then option chips at their
// real 40px height.
const CHIP_WIDTHS = [86, 64, 104, 72, 92, 58, 80];
export function FilterContentSkeleton() {
  return (
    <View>
      <View style={styles.head}>
        <SkeletonText size={18} width="50%" style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CHIP_WIDTHS.map((w, i) => <Skeleton key={i} style={{ width: w, height: 40, borderRadius: radius.pill }} />)}
      </View>
    </View>
  );
}

export default function FilterContent({ category, filters, draft, count, transitionKey, onValue, onQuery, onClear }) {
  const p = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isReducedMotion()) return;
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [transitionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!category) return null;
  const { query, values } = draft;
  const many = category.filters.length > 1;

  let body;
  if (category.panel === "location") {
    body = <LocationFilter city={query.city} locality={query.locality} search={query.search} onChange={onQuery} />;
  } else if (category.panel === "developer") {
    body = <DeveloperFilter value={query.developer} onChange={(developer) => onQuery({ developer })} />;
  } else if (category.panel === "project") {
    body = <ProjectFilter value={query.project} onChange={(project) => onQuery({ project })} />;
  } else {
    body = filters.map((f, i) => (
      <View key={f.id} style={i ? styles.next : null}>
        <FilterControl filter={f} value={values[f.id]} onChange={(v) => onValue(f.id, v)} title={many} wrap />
      </View>
    ));
  }

  return (
    <Animated.View
      style={{
        opacity: p,
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">{category.label}</Text>
        {count ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${category.label}`}
          >
            <Ionicons name="close-circle" size={14} color={colors.error} />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A divider under the title keeps its Clear button apart from the options below.
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  // Red outlined pill (as Compare's "Clear All"), so it never reads as one of the violet options.
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: "#F5C2C2",
    backgroundColor: "#FFF6F6",
  },
  clearText: { fontSize: 12.5, fontWeight: "800", color: colors.error },
  next: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
});
