import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Cover } from "./PropertyCard";
import PressableScale from "./PressableScale";
import { colors, fonts, radius, shadow } from "../theme";

export const COL_W = 168;

// Column header of the comparison table: cover, title, price and a remove button.
export default function CompareCard({ property: p, onRemove, onOpen, best }) {
  return (
    <PressableScale
      onPress={onOpen}
      to={0.97}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={p.title}
    >
      {/* Frosted Glass layers */}
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.94)", "rgba(255, 255, 255, 0.78)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]}
        pointerEvents="none"
      />

      <Cover uri={p.image} style={styles.img} />
      <PressableScale
        onPress={onRemove}
        to={0.88}
        hitSlop={8}
        style={styles.x}
        accessibilityLabel={`Remove ${p.title}`}
      >
        <Ionicons name="close" size={15} color={colors.ink} />
      </PressableScale>
      {best ? (
        <View style={styles.best}>
          <Text style={styles.bestText}>Lowest price</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {p.title}
        </Text>
        {p.price ? <Text style={styles.price}>{p.price}</Text> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: COL_W,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
    ...shadow.glass,
  },
  img: { width: "100%", height: 96 },
  x: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  best: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    zIndex: 2,
  },
  bestText: { color: colors.white, fontSize: 9.5, fontWeight: "800" },
  body: { padding: 10, zIndex: 1 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 19,
    color: colors.ink,
    minHeight: 38,
  },
  price: {
    color: colors.goldDeep,
    fontWeight: "800",
    fontSize: 15,
    marginTop: 4,
  },
});
