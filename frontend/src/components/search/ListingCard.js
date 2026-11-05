import React, { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import PressableScale from "../PressableScale";
import HeartButton from "../HeartButton";
import Marquee from "../Marquee";
import { Cover, useEnquire } from "../PropertyCard";
import { useAuth } from "../../context/AuthContext";
import { useCompare } from "../../context/CompareContext";
import { useEntrance } from "../../hooks/useEntrance";
import { LinearGradient } from "expo-linear-gradient";
import { brand, colors, gradients, radius, shadow } from "../../theme";
import { listingName } from "../../utils/format";
import Text from "../AppText";

// Compact search-results card: cover photo on the left (status tag, wishlist heart), details on
// the right - scrolling title, location, price, beds / baths / area, one line of feature chips -
// with small "Compare" and "Enquire Now" buttons at the bottom. `tag` is the listing status
// ("For Sale", "For Rent"); rentals get a "/month" price suffix.
function ListingCard({ property: p, index = 0, tag }) {
  const nav = useNavigation();
  const enter = useEntrance(Math.min(index, 6) * 70, 16);
  const { isDeveloper } = useAuth();
  const { has, toggle } = useCompare();
  const inCompare = has(p.id);
  const enquire = useEnquire(p);
  const cover = p.image || p.galleryImages?.[0];

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
          <Cover uri={cover} style={StyleSheet.absoluteFill} iconSize={26} />
          {tag ? (
            <View style={[styles.tag, isRent && styles.tagRent]}>
              {isRent ? null : <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
              <Text style={[styles.tagText, isRent && styles.tagTextRent]}>{tag}</Text>
            </View>
          ) : null}
          <View style={styles.heart}>
            <HeartButton id={p.id} size={14} floating={false} />
          </View>
        </View>

        <View style={styles.body}>
          <Marquee style={styles.title}>{name}</Marquee>
          {where ? (
            <View style={styles.whereRow}>
              <Ionicons name="location-outline" size={11} color={brand.inkSoft} />
              <Text style={styles.where} numberOfLines={1}>{where}</Text>
            </View>
          ) : null}

          {price ? (
            <Text style={styles.price} numberOfLines={1}>
              {price}
              {isRent ? <Text style={styles.perMonth}> /month</Text> : null}
            </Text>
          ) : (
            <Text style={styles.noPrice}>Price on request</Text>
          )}

          {facts.length ? (
            <View style={styles.facts}>
              {facts.map((f) => (
                <View key={f.icon} style={styles.fact}>
                  <Ionicons name={f.icon} size={12} color={brand.ink} />
                  <Text style={styles.factText} numberOfLines={1}>{f.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((c) => (
                <View key={c.text} style={styles.chip}>
                  <Ionicons name={c.icon} size={10} color={brand.inkSoft} />
                  <Text style={styles.chipText} numberOfLines={1}>{c.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Developers only preview listings: no comparing or enquiring (as on the details screen). */}
          {isDeveloper ? null : (
            <View style={styles.actions}>
              <PressableScale
                onPress={(e) => {
                  e?.stopPropagation?.();
                  toggle(p.id);
                }}
                to={0.92}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[styles.cmpBtn, inCompare && styles.cmpBtnOn]}
                accessibilityRole="button"
                accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
              >
                <Ionicons name={inCompare ? "checkmark-circle" : "swap-horizontal"} size={13} color={brand.violet} />
                <Text style={styles.cmpText} numberOfLines={1}>{inCompare ? "Added" : "Compare"}</Text>
              </PressableScale>
              <PressableScale
                onPress={(e) => {
                  e?.stopPropagation?.();
                  enquire();
                }}
                to={0.94}
                hitSlop={{ top: 6, bottom: 6 }}
                style={styles.enqBtn}
                accessibilityRole="button"
                accessibilityLabel={`Enquire now about ${name || "this property"}`}
              >
                <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Ionicons name="chatbubble-ellipses" size={12} color={colors.white} />
                <Text style={styles.enqText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Enquire Now</Text>
              </PressableScale>
            </View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default memo(ListingCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 10,
    padding: 7,
    borderRadius: radius.md + 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.06)",
    ...shadow.card,
  },
  // Stretches to the details' height.
  photo: { width: "33%", minHeight: 108, borderRadius: 12, overflow: "hidden", backgroundColor: brand.lavender },
  tag: { position: "absolute", top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  tagRent: { backgroundColor: "rgba(255, 255, 255, 0.92)" },
  tagText: { fontSize: 9.5, fontWeight: "800", color: colors.white },
  tagTextRent: { color: brand.deep },
  heart: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0, paddingTop: 1, paddingRight: 1 },
  title: { fontSize: 14.5, lineHeight: 19, fontWeight: "800", color: brand.ink },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  where: { flexShrink: 1, fontSize: 11.5, color: brand.inkSoft },
  price: { fontSize: 15.5, fontWeight: "800", color: brand.violet, marginTop: 3 },
  perMonth: { fontSize: 11, fontWeight: "700", color: brand.inkSoft },
  noPrice: { fontSize: 12.5, fontWeight: "700", color: brand.inkSoft, marginTop: 3 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 9, rowGap: 2, marginTop: 3 },
  fact: { flexDirection: "row", alignItems: "center", gap: 3 },
  factText: { fontSize: 11, fontWeight: "600", color: brand.ink },
  // One line only: a chip that doesn't fit shrinks and truncates.
  chips: { flexDirection: "row", gap: 5, marginTop: 5, overflow: "hidden" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FAF8FF",
  },
  chipText: { flexShrink: 1, fontSize: 10, fontWeight: "600", color: brand.inkSoft },
  // Outlined Compare + gradient Enquire, like the details screen's bottom bar but pocket-sized.
  actions: { flexDirection: "row", gap: 6, marginTop: 7 },
  cmpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: brand.lavenderMid,
    backgroundColor: colors.white,
  },
  cmpBtnOn: { backgroundColor: brand.lavender, borderColor: brand.violet },
  cmpText: { fontSize: 11, fontWeight: "800", color: brand.violet },
  enqBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 9,
    overflow: "hidden",
  },
  enqText: { flexShrink: 1, fontSize: 11, fontWeight: "800", color: colors.white },
});
