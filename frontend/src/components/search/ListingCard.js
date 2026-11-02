import React, { memo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import PressableScale from "../PressableScale";
import HeartButton from "../HeartButton";
import { Cover } from "../PropertyCard";
import { useCompare } from "../../context/CompareContext";
import { useEntrance } from "../../hooks/useEntrance";
import { LinearGradient } from "expo-linear-gradient";
import { brand, colors, gradients, radius, shadow } from "../../theme";
import { listingName } from "../../utils/format";
import Text from "../AppText";

const MAX_DOTS = 3;

// Search-results card: photo carousel on the left (status tag, wishlist heart, arrows, photo
// count), details on the right - title, location, price with a Compare pill, beds / baths / area,
// and up to two feature chips. `tag` is the listing status ("For Sale", "For Rent"), `perMonth`
// suffixes the price for rentals.
function ListingCard({ property: p, index = 0, tag, perMonth }) {
  const nav = useNavigation();
  const enter = useEntrance(Math.min(index, 6) * 70, 16);
  const { has, toggle } = useCompare();
  const inCompare = has(p.id);
  const photos = p.galleryImages?.length ? p.galleryImages : [p.image].filter(Boolean);
  const [shown, setShown] = useState(0);
  const step = (d) => setShown((i) => (i + d + photos.length) % photos.length);

  const name = listingName(p);
  const where = [p.locality, p.city].filter(Boolean).join(", ");
  const price = p.priceMin ? `${p.priceMin} – ${p.price}` : p.price;
  const facts = [
    p.bhk && { icon: "bed-outline", text: `${p.bhk} Beds` },
    p.bathrooms && { icon: "water-outline", text: `${p.bathrooms} Baths` },
    p.area && { icon: "resize-outline", text: p.area },
  ].filter(Boolean);
  const chips = [
    p.furnishing && { icon: "bed-outline", text: p.furnishing },
    p.parkings && { icon: "car-outline", text: "Parking" },
    ...(p.amenities || []).map((a) => ({ icon: "sparkles-outline", text: a })),
  ].filter(Boolean).slice(0, 2);
  const isRent = tag === "For Rent";
  const open = () => nav.navigate("PropertyDetails", { id: p.id, preview: p, tag });

  return (
    <Animated.View style={enter}>
      <PressableScale
        onPress={open}
        to={0.98}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={[name, price, where].filter(Boolean).join(", ")}
      >
        <View style={styles.photo}>
          <Cover uri={photos[shown]} style={StyleSheet.absoluteFill} iconSize={28} />
          {tag ? (
            <View style={[styles.tag, isRent && styles.tagRent]}>
              {isRent ? null : <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
              <Text style={[styles.tagText, isRent && styles.tagTextRent]}>{tag}</Text>
            </View>
          ) : null}
          <View style={styles.heart}>
            <HeartButton id={p.id} size={16} floating={false} />
          </View>
          {photos.length > 1 ? (
            <>
              <Arrow side="left" onPress={() => step(-1)} />
              <Arrow side="right" onPress={() => step(1)} />
              <View style={styles.dots} pointerEvents="none">
                {Array.from({ length: Math.min(photos.length, MAX_DOTS) }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === Math.min(shown, MAX_DOTS - 1) && styles.dotOn]} />
                ))}
              </View>
            </>
          ) : null}
          {photos.length ? (
            <View style={styles.counter} pointerEvents="none">
              <Ionicons name="images-outline" size={10} color={colors.white} />
              <Text style={styles.counterText}>{`${shown + 1}/${photos.length}`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          {where ? (
            <View style={styles.whereRow}>
              <Ionicons name="location-outline" size={12} color={brand.inkSoft} />
              <Text style={styles.where} numberOfLines={1}>{where}</Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            {price ? (
              <Text style={styles.price} numberOfLines={1}>
                {price}
                {isRent ? <Text style={styles.perMonth}> /month</Text> : null}
              </Text>
            ) : (
              <Text style={styles.noPrice}>Price on request</Text>
            )}
            <PressableScale
              onPress={(e) => {
                e?.stopPropagation?.();
                toggle(p.id);
              }}
              to={0.9}
              hitSlop={6}
              style={[styles.compare, inCompare && styles.compareOn]}
              accessibilityRole="button"
              accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
            >
              {inCompare ? <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
              <Ionicons name={inCompare ? "checkmark" : "swap-horizontal"} size={12} color={inCompare ? colors.white : brand.violet} />
              <Text style={[styles.compareText, inCompare && { color: colors.white }]}>{inCompare ? "Added" : "Compare"}</Text>
            </PressableScale>
          </View>

          {facts.length ? (
            <View style={styles.facts}>
              {facts.map((f) => (
                <View key={f.icon} style={styles.fact}>
                  <Ionicons name={f.icon} size={13} color={brand.ink} />
                  <Text style={styles.factText} numberOfLines={1}>{f.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((c) => (
                <View key={c.text} style={styles.chip}>
                  <Ionicons name={c.icon} size={11} color={brand.inkSoft} />
                  <Text style={styles.chipText} numberOfLines={1}>{c.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function Arrow({ side, onPress }) {
  return (
    <Pressable
      onPress={(e) => {
        e?.stopPropagation?.();
        onPress();
      }}
      hitSlop={8}
      style={[styles.arrow, side === "left" ? { left: 6 } : { right: 6 }]}
      accessibilityRole="button"
      accessibilityLabel={side === "left" ? "Previous photo" : "Next photo"}
    >
      <Ionicons name={side === "left" ? "chevron-back" : "chevron-forward"} size={13} color={brand.ink} />
    </Pressable>
  );
}

export default memo(ListingCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.06)",
    ...shadow.card,
  },
  photo: { width: "40%", minHeight: 128, borderRadius: 14, overflow: "hidden", backgroundColor: brand.lavender },
  tag: { position: "absolute", top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: "hidden" },
  tagRent: { backgroundColor: "rgba(255, 255, 255, 0.92)" },
  tagText: { fontSize: 10.5, fontWeight: "800", color: colors.white },
  tagTextRent: { color: brand.deep },
  heart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { position: "absolute", bottom: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255, 255, 255, 0.55)" },
  dotOn: { backgroundColor: colors.white },
  counter: {
    position: "absolute",
    right: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(15, 8, 36, 0.6)",
  },
  counterText: { fontSize: 10, fontWeight: "700", color: colors.white },
  body: { flex: 1, minWidth: 0, paddingVertical: 2 },
  title: { fontSize: 15, fontWeight: "800", color: brand.ink },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  where: { flexShrink: 1, fontSize: 12, color: brand.inkSoft },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  price: { flex: 1, fontSize: 18, fontWeight: "800", color: brand.violet },
  perMonth: { fontSize: 12, fontWeight: "700", color: brand.inkSoft },
  noPrice: { flex: 1, fontSize: 13, fontWeight: "700", color: brand.inkSoft },
  compare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: brand.lavender,
  },
  compareOn: { backgroundColor: brand.violet },
  compareText: { fontSize: 11, fontWeight: "800", color: brand.violet },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 4, marginTop: 8 },
  fact: { flexDirection: "row", alignItems: "center", gap: 4 },
  factText: { fontSize: 11.5, fontWeight: "600", color: brand.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FAF8FF",
  },
  chipText: { flexShrink: 1, fontSize: 10.5, fontWeight: "600", color: brand.inkSoft },
});
