import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { AnimatedText } from "./AppText";

// Headline word that cycles through `words`: the current word lifts away, then the next one
// cascades in letter by letter while a soft highlight sweeps in beneath it. Purely visual - the
// parent heading carries the accessible label. `active` = false freezes it (screen hidden).
export default function HeroRotatingWord({ words, active = true, interval = 2600, style, highlightColor }) {
  const [index, setIndex] = useState(0);
  const maxLen = Math.max(...words.map((w) => w.length));
  const chars = useRef(Array.from({ length: maxLen }, () => new Animated.Value(0))).current;
  const out = useRef(new Animated.Value(0)).current; // 0 shown · 1 lifted away
  const sweep = useRef(new Animated.Value(0)).current;

  const word = words[index % words.length];

  // Bring the current word in, one letter at a time.
  useEffect(() => {
    out.setValue(0);
    if (isReducedMotion()) {
      chars.forEach((v) => v.setValue(1));
      sweep.setValue(1);
      return;
    }
    chars.forEach((v) => v.setValue(0));
    sweep.setValue(0);
    Animated.parallel([
      Animated.stagger(
        45,
        chars.slice(0, word.length).map((v) =>
          Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true })
        )
      ),
      Animated.timing(sweep, { toValue: 1, duration: 520, delay: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || words.length < 2) return undefined;
    const id = setInterval(() => {
      if (isReducedMotion()) {
        setIndex((n) => (n + 1) % words.length);
        return;
      }
      Animated.timing(out, { toValue: 1, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setIndex((n) => (n + 1) % words.length);
      });
    }, interval);
    return () => clearInterval(id);
  }, [active, words.length, interval]); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = {
    opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }],
  };

  return (
    <Animated.View style={[styles.word, leave]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View
        style={[styles.highlight, highlightColor && { backgroundColor: highlightColor }, { opacity: sweep, transform: [{ scaleX: sweep }] }]}
      />
      {word.split("").map((ch, i) => (
        <AnimatedText
          key={`${index}-${i}`}
          style={[
            style,
            {
              opacity: chars[i],
              transform: [
                { translateY: chars[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                { scale: chars[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
          ]}
        >
          {ch}
        </AnimatedText>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  word: { flexDirection: "row", alignItems: "flex-end" },
  // Marker-style band behind the lower half of the word; grows out from its centre.
  highlight: {
    position: "absolute",
    left: -4,
    right: -4,
    bottom: 6,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(124,44,245,0.16)",
  },
});
