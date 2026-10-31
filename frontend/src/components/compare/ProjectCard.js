import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Cover } from "../PropertyCard";
import PressableScale from "../PressableScale";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { brand, colors, radius, shadow } from "../../theme";
import Text from "../AppText";
import { INSIGHT_STYLE } from "./insightStyle";

// Header card for one compared project: numbered, removable, with its strongest badge.
// Springs in on mount (staggered by `index`) and shrinks away before `onRemove` fires.
export default function ProjectCard({ property: p, index, width, badge, onOpen, onRemove }) {
  const reduced = isReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const leave = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return;
    Animated.parallel([
      Animated.spring(enter, { toValue: 1, delay: 90 * index, speed: 9, bounciness: 7, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, delay: 90 * index + 260, speed: 12, bounciness: 14, useNativeDriver: true }),
    ]).start();
  }, [enter, pop, index, reduced]);

  const remove = () => {
    if (reduced) return onRemove();
    Animated.timing(leave, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onRemove);
  };

  const shown = Animated.multiply(enter, leave);
  const photos = p.galleryImages?.length || (p.image ? 1 : 0);
  const look = badge ? INSIGHT_STYLE[badge.key] : null;
  const facts = [p.bhk && `${p.bhk} BHK`, p.area].filter(Boolean);

  return (
    <Animated.View
      style={{
        width,
        opacity: shown,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
          { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
        ],
      }}
    >
      <PressableScale onPress={onOpen} to={0.96} style={styles.card} accessibilityRole="button" accessibilityLabel={`Open ${p.title}`}>
        <View>
          <Cover uri={p.image} style={styles.img} iconSize={26} />
          <Animated.View style={[styles.num, { transform: [{ scale: pop }] }]}>
            <Text style={styles.numText}>{index + 1}</Text>
          </Animated.View>
          <PressableScale onPress={remove} to={0.85} hitSlop={8} style={styles.x} accessibilityLabel={`Remove ${p.title}`}>
            <Ionicons name="close" size={14} color={colors.ink} />
          </PressableScale>
          {photos > 0 ? (
            <View style={styles.photos}>
              <Ionicons name="images-outline" size={10} color={colors.white} />
              <Text style={styles.photosText}>1/{photos}</Text>
            </View>
          ) : null}
          {badge ? (
            <Animated.View style={[styles.badge, { backgroundColor: look.soft, transform: [{ scale: pop }] }]}>
              <Ionicons name={look.icon} size={10} color={look.color} />
              <Text style={[styles.badgeText, { color: look.color }]} numberOfLines={1}>{badge.badge}</Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
          {p.locality || p.city ? (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={11} color={colors.muted} />
              <Text style={styles.loc} numberOfLines={1}>{[p.locality, p.city].filter(Boolean).join(", ")}</Text>
            </View>
          ) : null}
          {p.price ? <Text style={styles.price} numberOfLines={1}>{p.price}</Text> : null}
          {facts.length ? <Text style={styles.facts} numberOfLines={1}>{facts.join("  |  ")}</Text> : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// Dashed slot inviting another project while there's room.
export function AddSlot({ width, index, onPress }) {
  const v = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: 90 * index + 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={{ width, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
      <PressableScale onPress={onPress} to={0.95} style={styles.add} accessibilityRole="button" accessibilityLabel="Add a project to compare">
        <View style={styles.addIcon}>
          <Ionicons name="add" size={22} color={brand.violet} />
        </View>
        <Text style={styles.addText}>Add project</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.08)",
    ...shadow.card,
  },
  img: { width: "100%", height: 96 },
  num: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  numText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  x: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photos: {
    position: "absolute",
    right: 7,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(15, 8, 36, 0.55)",
  },
  photosText: { color: colors.white, fontSize: 9.5, fontWeight: "700" },
  badge: {
    position: "absolute",
    left: 6,
    bottom: -9,
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white,
  },
  badgeText: { fontSize: 9.5, fontWeight: "800" },
  body: { paddingHorizontal: 9, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: colors.ink, minHeight: 34 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  loc: { flex: 1, fontSize: 10.5, color: colors.muted },
  price: { fontSize: 15, fontWeight: "800", color: brand.violet, marginTop: 6 },
  facts: { fontSize: 10.5, color: colors.muted, marginTop: 3, fontWeight: "600" },
  add: {
    flex: 1,
    minHeight: 200,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(124, 44, 245, 0.35)",
    backgroundColor: "rgba(241, 235, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  addText: { fontSize: 12, fontWeight: "800", color: brand.violet },
});
