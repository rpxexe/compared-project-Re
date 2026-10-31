import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { brand, colors } from "../theme";
import Text from "./AppText";

// The CP monogram cropped from the brand artwork (assets/logo_compareprojects.png), on a
// transparent background so it sits on both the light canvas and the dark screens.
const MARK = require("../../assets/logo_mark.png");

// `tone` is kept for backwards compatibility with existing callers.
export function LogoMark({ size = 56 }) {
  return <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} accessible={false} />;
}

// Mark + "CompareProjects" wordmark, all in the brand violet like the artwork.
// `tone="light"` is for dark backgrounds.
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
          { color: onDark ? colors.neon : brand.violet, fontSize: wordSize ?? Math.round(size * 0.45) },
        ]}
        numberOfLines={1}
      >
        CompareProjects
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  word: { marginLeft: 8, fontWeight: "800", letterSpacing: -0.2 },
});
