import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { Cover } from "./PropertyCard";
import { smoothLayout } from "./compare/CompareTable";
import { useCompare } from "../context/CompareContext";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { api } from "../services/api";
import { COMPARE_MAX } from "../utils/compare";
import { listingName } from "../utils/format";
import { brand, colors, gradients, radius } from "../theme";
import Text from "./AppText";

// Card that sits on top of the bottom navigation while projects are queued for comparison:
// how many are picked, "Compare Now", and a chip per project so any one can be taken out.
export default function CompareTray({ onCompare }) {
  const { ids, count, remove } = useCompare();
  const [byId, setById] = useState({}); // id -> listing, kept across changes so chips don't flicker
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // The compare list only stores ids; fetch names and photos for any we haven't seen yet.
  const key = ids.join(",");
  useEffect(() => {
    const missing = ids.filter((id) => !(id in byId));
    if (!missing.length) return undefined;
    let alive = true;
    api
      .compare(ids)
      // Ids the server no longer returns (removed listings) become null: shown as unavailable.
      .then((r) => alive && setById((m) => ({
        ...m,
        ...Object.fromEntries(missing.map((id) => [id, null])),
        ...Object.fromEntries((r.items || []).map((p) => [p.id, p])),
      })))
      .catch(() => {});
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A little bounce on the count each time a project is added or removed.
  useEffect(() => {
    if (first.current || isReducedMotion()) {
      first.current = false;
      return;
    }
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, speed: 16, bounciness: 14, useNativeDriver: true }).start();
  }, [count, pop]);

  const title = count === 1 ? "1 item added to compare" : `${count} items selected for compare`;
  const sub = count === 1 ? "Add one more project to compare" : count < COMPARE_MAX ? `You can add up to ${COMPARE_MAX}` : "Ready to compare";
  const drop = (id) => {
    smoothLayout();
    remove(id);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head} accessibilityLiveRegion="polite">
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.count}>
            <Text style={styles.countText}>{count}</Text>
          </LinearGradient>
        </Animated.View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <PressableScale onPress={onCompare} to={0.94} style={styles.btn} accessibilityRole="button" accessibilityLabel={`Compare now, ${count} selected`}>
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.btnText}>Compare Now</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.white} />
        </PressableScale>
      </View>

      <View style={styles.chips}>
        {ids.map((id) => {
          const p = byId[id];
          const name = p ? listingName(p) : p === null ? "Unavailable" : "Loading…";
          return (
            <View key={id} style={styles.chip}>
              <Cover uri={p?.image} style={styles.thumb} iconSize={12} />
              <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
              <Pressable
                onPress={() => drop(id)}
                hitSlop={8}
                style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p ? name : "property"} from compare`}
              >
                <Ionicons name="close" size={12} color={brand.deep} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: brand.lavenderMid,
    boxShadow: "0 6px 18px rgba(20, 10, 46, 0.14)",
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  count: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 15, fontWeight: "800", color: colors.white },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 13.5, fontWeight: "800", color: brand.ink },
  sub: { fontSize: 11.5, color: brand.inkSoft, marginTop: 1 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  btnText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  // Up to three chips share the row equally.
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    minWidth: 0,
    maxWidth: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingLeft: 3,
    paddingRight: 4,
    borderRadius: radius.pill,
    backgroundColor: brand.lavender,
  },
  thumb: { width: 26, height: 26, borderRadius: 13, overflow: "hidden" },
  chipText: { flex: 1, fontSize: 11.5, fontWeight: "700", color: brand.ink },
  remove: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
});
