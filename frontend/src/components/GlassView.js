import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { radius, surfaces } from "../theme";

const LEVELS = {
  soft: surfaces.glassSoft,
  regular: surfaces.glass,
  strong: surfaces.glassStrong,
};

// Frosted surface used across onboarding and floating controls.
// - `level` picks translucency: keep `strong` for anything holding form inputs.
// - `blur` adds a native backdrop blur on iOS/web only. Android's BlurView needs an
//   experimental, GPU-heavy mode, so it gets the translucent fill + sheen instead.
export default function GlassView({
  children,
  style,
  level = "regular",
  blur = false,
  intensity = 24,
  borderRadius = radius.lg,
  ...rest
}) {
  const surface = LEVELS[level] || LEVELS.regular;
  const useBlur = blur && Platform.OS !== "android";
  return (
    <View
      style={[styles.base, surface, { borderRadius }, useBlur && level !== "strong" && styles.blurFill, style]}
      {...rest}
    >
      <View
        style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}
        pointerEvents="none"
      >
        {useBlur ? (
          <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        {/* Soft top-left light source; this is what reads as "glass" rather than flat white. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    shadowColor: "#4C16B8",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  // With a real blur behind it the fill can be lighter without losing legibility.
  blurFill: { backgroundColor: "rgba(255,255,255,0.5)" },
});
