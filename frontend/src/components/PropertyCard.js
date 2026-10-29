import React, { memo, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import PressableScale from "./PressableScale";
import HeartButton from "./HeartButton";
import { useCompare } from "../context/CompareContext";
import { useEntrance } from "../hooks/useEntrance";
import { colors, fonts, radius, shadow } from "../theme";
import { propertyFacts, ratingLabel } from "../utils/format";

export function badgeFor(p) {
  if (p.featured) return "Featured";
  const s = `${p.possessionStatus} ${p.propertyGroup}`;
  if (/new\s*launch|pre[-\s]?launch/i.test(s)) return "New Launch";
  if (/upcoming/i.test(s)) return "Upcoming";
  return "";
}

export function Cover({ uri, style, iconSize = 34 }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <LinearGradient
        colors={[colors.lavender, colors.champagneSoft]}
        style={[style, styles.ph]}
      >
        <Ionicons
          name="business-outline"
          size={iconSize}
          color={colors.goldDeep}
        />
      </LinearGradient>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

function CompareToggle({ id, dark }) {
  const { has, toggle } = useCompare();
  const on = has(id);
  return (
    <PressableScale
      to={0.88}
      onPress={(e) => {
        e?.stopPropagation?.();
        toggle(id);
      }}
      style={[
        styles.cmp,
        on && { backgroundColor: colors.gold, borderColor: colors.gold },
        dark && !on && styles.cmpDark,
      ]}
      accessibilityRole="button"
      accessibilityLabel={on ? "Remove from compare" : "Add to compare"}
    >
      <Ionicons
        name={on ? "checkmark" : "swap-horizontal"}
        size={17}
        color={colors.ink}
      />
    </PressableScale>
  );
}

function RatingChip({ rating, light }) {
  if (!rating) return null;
  return (
    <View
      style={[
        styles.rate,
        light && styles.rateLight,
      ]}
    >
      <Ionicons name="star" size={11} color={colors.gold} />
      <Text style={[styles.rateText, light && { color: colors.ivory }]}>
        {ratingLabel(rating)}
      </Text>
    </View>
  );
}

function PropertyCard({ property: p, variant = "row", index = 0, style }) {
  const nav = useNavigation();
  const enter = useEntrance(Math.min(index, 6) * 70, 16);
  const open = () => nav.navigate("PropertyDetails", { id: p.id, preview: p });
  const where = [p.locality, p.city].filter(Boolean).join(", ");
  const badge = badgeFor(p);
  const facts = propertyFacts(p);

  if (variant === "hero") {
    return (
      <Animated.View style={[enter, style]}>
        <PressableScale
          onPress={open}
          to={0.97}
          style={styles.hero}
          accessibilityRole="button"
          accessibilityLabel={p.title}
        >
          <Cover uri={p.image} style={StyleSheet.absoluteFill} iconSize={48} />
          <LinearGradient
            colors={[
              "rgba(20,10,46,0.05)",
              "rgba(20,10,46,0.38)",
              "rgba(20,10,46,0.92)",
            ]}
            style={StyleSheet.absoluteFill}
          />
          {/* Top specular border sheen */}
          <LinearGradient
            colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0.02)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            pointerEvents="none"
          />
          <View style={styles.heroTop}>
            {badge ? (
              <View style={[styles.badge, styles.glassBadge]}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : (
              <View />
            )}
            <HeartButton id={p.id} />
          </View>
          <View style={styles.heroBottom}>
            <RatingChip rating={p.rating} light />
            <Text style={styles.heroTitle} numberOfLines={2}>
              {p.title}
            </Text>
            {where ? (
              <Text style={styles.heroLoc} numberOfLines={1}>
                {where}
              </Text>
            ) : null}
            <View style={styles.heroFoot}>
              <View style={{ flex: 1 }}>
                {p.price ? (
                  <Text style={styles.heroPrice}>
                    {p.priceMin ? `${p.priceMin} – ${p.price}` : p.price}
                  </Text>
                ) : null}
                {facts.length ? (
                  <Text style={styles.heroFacts} numberOfLines={1}>
                    {facts.join("  ·  ")}
                  </Text>
                ) : null}
              </View>
              <CompareToggle id={p.id} dark />
            </View>
          </View>
        </PressableScale>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[enter, style]}>
      <PressableScale
        onPress={open}
        to={0.98}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={p.title}
      >
        {/* Frosted Liquid Glass layers */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius.lg, overflow: "hidden" },
          ]}
          pointerEvents="none"
        >
          <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.78)", "rgba(244, 235, 255, 0.58)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.95)",
              "rgba(224, 195, 255, 0.35)",
              "rgba(255, 255, 255, 0.05)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View>
          <Cover uri={p.image} style={styles.rowImg} />
          {badge ? (
            <View style={[styles.badge, styles.rowBadge, styles.glassBadge]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {p.title}
            </Text>
            <HeartButton id={p.id} size={19} floating={false} />
          </View>
          {where ? (
            <Text style={styles.rowLoc} numberOfLines={1}>
              {where}
            </Text>
          ) : null}
          {facts.length ? (
            <Text style={styles.rowFacts} numberOfLines={1}>
              {facts.join("  ·  ")}
            </Text>
          ) : null}
          {p.developerName ? (
            <Text style={styles.rowDev} numberOfLines={1}>
              by {p.developerName}
            </Text>
          ) : null}
          <View style={styles.rowFoot}>
            <View style={{ flex: 1 }}>
              {p.price ? (
                <Text style={styles.rowPrice}>
                  {p.priceMin ? `${p.priceMin} – ${p.price}` : p.price}
                </Text>
              ) : null}
              <RatingChip rating={p.rating} />
            </View>
            <CompareToggle id={p.id} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default memo(PropertyCard);

const styles = StyleSheet.create({
  ph: { alignItems: "center", justifyContent: "center" },
  hero: {
    width: 258,
    height: 250,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.plum,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    ...shadow.glassFloat,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    zIndex: 2,
  },
  heroBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    zIndex: 2,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 21,
    lineHeight: 26,
    color: colors.white,
    marginTop: 6,
  },
  heroLoc: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, marginTop: 3 },
  heroFoot: { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
  heroPrice: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  heroFacts: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, marginTop: 2 },
  badge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  glassBadge: {
    backgroundColor: "rgba(201, 162, 255, 0.88)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderRadius: radius.lg,
    padding: 10,
    gap: 12,
    borderWidth: 1.4,
    borderColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
    ...shadow.glassFloat,
  },
  rowImg: {
    width: 112,
    height: 124,
    borderRadius: radius.md - 2,
    overflow: "hidden",
  },
  rowBadge: { position: "absolute", left: 6, top: 6, zIndex: 2 },
  rowBody: { flex: 1, paddingVertical: 2, zIndex: 1 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  rowTitle: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 20,
  },
  rowLoc: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  rowFacts: {
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
    fontWeight: "600",
  },
  rowDev: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  rowFoot: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: "auto",
    paddingTop: 6,
  },
  rowPrice: { fontSize: 16, fontWeight: "800", color: colors.goldDeep },
  rate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(235, 226, 255, 0.75)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  rateLight: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  rateText: { fontSize: 11, fontWeight: "800", color: colors.ink },
  cmp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(228, 219, 250, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  cmpDark: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
  },
});
