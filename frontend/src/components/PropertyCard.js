import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import PressableScale from "./PressableScale";
import HeartButton from "./HeartButton";
import { useAuth } from "../context/AuthContext";
import { useCompare } from "../context/CompareContext";
import { useEntrance } from "../hooks/useEntrance";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { brand, colors, fonts, glowSubtle, gradients, radius, shadow } from "../theme";
import { listingName, propertyFacts, ratingLabel } from "../utils/format";
import Text from "./AppText";

export function badgeFor(p) {
  if (p.featured) return "Featured";
  const s = `${p.possessionStatus} ${p.propertyGroup}`;
  if (/new\s*launch|pre[-\s]?launch/i.test(s)) return "New Launch";
  if (/upcoming/i.test(s)) return "Upcoming";
  return "";
}

// Listing photos are full-size Cloudinary PNGs (~1.4 MB each). Cards ask Cloudinary for a
// resized, auto-format (WebP) copy instead - ~25x smaller, so rails scroll without decode stalls.
// `full` keeps the original (e.g. the details gallery). Non-Cloudinary or already-transformed
// URLs pass through unchanged.
export function sizedImage(uri, width = 640) {
  if (typeof uri !== "string") return uri;
  const m = uri.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.*)$/);
  return m ? `${m[1]}f_auto,q_auto,w_${width}/${m[2]}` : uri;
}

export function Cover({ uri, style, iconSize = 34, full = false }) {
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
      source={{ uri: full ? uri : sizedImage(uri) }}
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

  return <RowCard p={p} enter={enter} style={style} open={open} where={where} badge={badge} facts={facts} />;
}

// White card with the details on the left and the photo on the right behind a curved edge;
// "Enquire Now" and "Add to Compare" pills along the bottom.
function RowCard({ p, enter, style, open, where, badge, facts }) {
  const nav = useNavigation();
  const { token, openLoginPrompt } = useAuth();
  const { has, toggle } = useCompare();
  const inCompare = has(p.id);
  const name = listingName(p);
  const price = p.priceMin ? `${p.priceMin} – ${p.price}` : p.price;
  const rating = ratingLabel(p.rating);

  // Guests get the sign-in prompt right here; signed-in users land on the details screen with
  // the enquiry form already open.
  const enquire = () => {
    if (!token) {
      openLoginPrompt({
        reason: "enquiry",
        title: "Sign In to Enquire",
        message: `Please sign in to connect directly with the builder for ${name || "this property"}.`,
      });
      return;
    }
    nav.navigate("PropertyDetails", { id: p.id, preview: p, enquire: true });
  };

  return (
    <Animated.View style={[enter, style]}>
      <PressableScale
        onPress={open}
        to={0.98}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={[name, rating && `rated ${rating}`, price, where].filter(Boolean).join(", ")}
      >
        <View style={styles.photo} pointerEvents="box-none">
          <Cover uri={p.image} style={StyleSheet.absoluteFill} iconSize={30} />
          <LinearGradient
            colors={["rgba(15, 8, 36, 0)", "rgba(15, 8, 36, 0.35)"]}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {badge ? (
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>{badge}</Text>
            </View>
          ) : null}
          <View style={styles.heartWrap}>
            <HeartButton id={p.id} size={19} floating={false} light />
          </View>
        </View>

        {/* The white side flows into the photo along a soft S-curve that widens at the bottom,
            leaving room for the action pills. Stretched to the card's height. */}
        <Svg style={styles.wave} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
          <Path d="M0 0 H34 C52 6 66 20 62 38 C58 54 44 60 48 76 C52 90 70 98 96 100 H0 Z" fill={colors.white} />
        </Svg>

        <View style={styles.body}>
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>
              {name}
            </Text>
            {rating || price ? (
              <View style={styles.metaRow}>
                {rating ? (
                  <>
                    <View style={styles.star}>
                      <Ionicons name="star" size={9} color={colors.white} />
                    </View>
                    <Text style={styles.metaText}>{rating}</Text>
                  </>
                ) : null}
                {rating && price ? <Text style={styles.metaText}>•</Text> : null}
                {price ? (
                  <Text style={[styles.metaText, styles.price]} numberOfLines={1}>
                    {price}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {facts.length ? (
              <Text style={styles.line} numberOfLines={1}>
                {facts.join(", ")}
              </Text>
            ) : null}
            {where ? (
              <Text style={styles.line} numberOfLines={1}>
                {where}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <CardAction label="Enquire Now" icon="chatbubble-ellipses" tint={gradients.info} onPress={enquire} />
            <CardAction
              label={inCompare ? "Added" : "Add to Compare"}
              icon={inCompare ? "checkmark" : "swap-horizontal"}
              tint={gradients.cta}
              onPress={() => toggle(p.id)}
              pop={inCompare}
              accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
            />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// Gradient pill with an uppercase label and a white icon disc. `pop` bounces the disc when it
// changes (e.g. added to / removed from compare).
function CardAction({ label, icon, tint, onPress, pop, accessibilityLabel }) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isReducedMotion()) return;
    Animated.sequence([
      Animated.timing(s, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, speed: 18, bounciness: 16, useNativeDriver: true }),
    ]).start();
  }, [pop, s]);

  return (
    <PressableScale
      to={0.93}
      onPress={(e) => {
        e?.stopPropagation?.();
        onPress();
      }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.actionWrap}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
        <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label.toUpperCase()}
        </Text>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale: s }] }]}>
          <Ionicons name={icon} size={11} color={tint[tint.length - 1]} />
        </Animated.View>
      </LinearGradient>
    </PressableScale>
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
  card: {
    minHeight: 172,
    borderRadius: 34,
    backgroundColor: colors.white,
    // No border: on Android the photo bleeds into a border row as a dark hairline under the curve.
    overflow: "hidden",
    ...shadow.card,
  },
  photo: { position: "absolute", top: 0, right: 0, bottom: 0, width: "42%", backgroundColor: brand.lavender },
  photoBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  photoBadgeText: { fontSize: 9.5, fontWeight: "800", color: brand.violet, letterSpacing: 0.3 },
  heartWrap: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  // Spans the photo's left edge (photo starts at 58%; the curve reaches ~71% at the bottom).
  // Overhangs top and bottom by 2px (clipped by the card) so no hairline of photo shows at the edges.
  wave: { position: "absolute", top: -2, bottom: -2, left: "52%", width: "20%" },
  body: { flex: 1, paddingLeft: 22, paddingTop: 18, paddingBottom: 16, justifyContent: "space-between" },
  textCol: { width: "56%" },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: brand.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  star: { width: 16, height: 16, borderRadius: 8, backgroundColor: brand.violet, alignItems: "center", justifyContent: "center" },
  metaText: { fontSize: 13, fontWeight: "800", color: brand.ink },
  price: { flexShrink: 1, color: brand.violet },
  line: { fontSize: 12.5, lineHeight: 17, color: brand.inkSoft, marginTop: 3 },
  actions: { flexDirection: "row", gap: 7, marginTop: 14, width: "72%" },
  actionWrap: { flexShrink: 1, ...glowSubtle },
  // Pill with a tighter top-right corner, like a tag.
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingLeft: 11,
    paddingRight: 4,
    borderRadius: 14,
    borderTopRightRadius: 5,
  },
  actionText: { flexShrink: 1, fontSize: 10.5, fontWeight: "800", color: colors.white, letterSpacing: 0.2 },
  actionIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
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
