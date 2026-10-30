import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import CPMark from "./CPMark";
import { brand, colors, gradients } from "../theme";
import Text from "./AppText";

// App-icon style tile with the CP monogram on the violet→magenta brand gradient.
// Reads well on both the lavender onboarding canvas and the dark screens.
// `tone` is kept for backwards compatibility with existing callers.
export function LogoMark({ size = 56 }) {
  return (
    <LinearGradient
      colors={gradients.logo}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3 },
      ]}
      accessible={false}
    >
      <CPMark size={size * 0.82} glow={false} gradientId={`cpTile${Math.round(size)}`} />
    </LinearGradient>
  );
}

// Mark + "CompareProjects" wordmark. `tone="light"` is for dark backgrounds.
export default function Logo({ tone = "light", size = 40, wordSize }) {
  const onDark = tone === "light";
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel="CompareProjects"
    >
      <LogoMark size={size} />
      <Text
        style={[
          styles.word,
          { color: onDark ? colors.white : brand.ink, fontSize: wordSize ?? Math.round(size * 0.45) },
        ]}
        numberOfLines={1}
      >
        Compare
        <Text style={{ color: onDark ? colors.neon : brand.violet }}>Projects</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: brand.violet,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center" },
  word: { marginLeft: 10, fontWeight: "800", letterSpacing: -0.2 },
});
