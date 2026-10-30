import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import FilterControl from "../filters/FilterControl";
import LocationFilter from "./LocationFilter";
import DeveloperFilter from "./DeveloperFilter";
import ProjectFilter from "./ProjectFilter";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { brand, colors } from "../../theme";
import Text from "../AppText";

// The selected sidebar category's controls. What to draw comes from the category's config
// entry: a special `panel`, or its config filters drawn by the shared FilterControl.
// `transitionKey` (tab + category) replays a short fade/slide when either changes.
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
    body = <LocationFilter city={query.city} locality={query.locality} onChange={onQuery} />;
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
          <Pressable onPress={onClear} hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel={`Clear ${category.label}`}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", marginBottom: 14, minHeight: 32 },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  clear: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  clearText: { fontSize: 14, fontWeight: "800", color: brand.violet },
  next: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
});
