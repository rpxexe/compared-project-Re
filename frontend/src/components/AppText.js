import React from "react";
import { Animated, StyleSheet, Text, TextInput } from "react-native";
import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

// The app font. Android picks a custom font's weight only by file, not by `fontWeight`, so each
// weight is its own family and AppText swaps `fontWeight` for the matching face. Styles keep
// using fontWeight as usual; `fontFamily: FONT_FAMILY` (theme `fonts`) or none means "the app
// font". Any other fontFamily (icon fonts, monospace) is left alone.
export const FONT_FAMILY = "PlusJakartaSans";

// Passed to expo-font's useFonts in App.js. FONT_FAMILY itself is registered as Regular so text
// drawn outside AppText still gets the app font rather than the system one.
export const FONT_FILES = {
  [FONT_FAMILY]: PlusJakartaSans_400Regular,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

const FACES = {
  100: "PlusJakartaSans_300Light",
  200: "PlusJakartaSans_300Light",
  300: "PlusJakartaSans_300Light",
  400: "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
  900: "PlusJakartaSans_800ExtraBold",
};

// Style patch that puts the right Jakarta face on `style`, or null to leave it as is.
// fontWeight is reset to normal: on Android a bold weight on top of a bold file renders faux-bold.
export function fontFace(style) {
  const s = StyleSheet.flatten(style) || {};
  if (s.fontFamily && s.fontFamily !== FONT_FAMILY) return null;
  return { fontFamily: FACES[String(s.fontWeight ?? 400)] || FACES[400], fontWeight: "normal" };
}

// True inside an AppText, so nested text can tell it has a parent.
const InText = React.createContext(false);

// Drop-in for react-native's Text. Nested text that doesn't set its own weight or family keeps
// its parent's face (a coloured word inside a bold sentence stays bold); everything else gets
// the Jakarta face for its weight.
export default function AppText({ style, children, ...props }) {
  const nested = React.useContext(InText);
  const s = nested ? StyleSheet.flatten(style) || {} : null;
  const inherit = nested && s.fontWeight == null && s.fontFamily == null;
  return (
    <InText.Provider value>
      <Text {...props} style={inherit ? style : [style, fontFace(style)]}>
        {children}
      </Text>
    </InText.Provider>
  );
}

export function AppTextInput({ style, ...props }) {
  return <TextInput {...props} style={[style, fontFace(style)]} />;
}

export const AnimatedText = Animated.createAnimatedComponent(AppText);
