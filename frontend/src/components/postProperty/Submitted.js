import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { useBottomSpace } from "../../hooks/useBottomSpace";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brand, colors, gradients } from "../../theme";
import Text from "../AppText";

const COLORS = ["#7C2CF5", "#F5B82E", "#D92CFF", "#3B6FE0", "#E0457B", "#0E9F6E"];
// Confetti bursting out of the tick: evenly spread angles, a mix of distances, sizes and spins.
const PIECES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const dist = 110 + (i % 3) * 38;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist * 0.85,
    fall: 70 + (i % 4) * 22,
    color: COLORS[i % COLORS.length],
    w: i % 3 === 0 ? 7 : 11,
    h: i % 3 === 0 ? 7 : 5,
    round: i % 3 === 0,
    spin: (i % 2 ? 1 : -1) * (240 + (i % 5) * 70),
  };
});
// Success state after posting: the tick pops in with a pulse and confetti bursts out of it;
// the title, message and `children` (the next-step buttons) fade in underneath.
export default function Submitted({ message, children }) {
  const insets = useSafeAreaInsets();
  const { bottom } = useBottomSpace();
  const pop = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Property submitted. ${message}`);
    if (isReducedMotion()) {
      [pop, tick, burst, copy].forEach((v) => v.setValue(1));
    } else {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(tick, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }), { iterations: 2 }),
          Animated.timing(copy, { toValue: 1, duration: 420, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: bottom }]}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <View style={styles.stage}>
          {PIECES.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                styles.piece,
                { width: p.w, height: p.h, borderRadius: p.round ? p.w / 2 : 2, backgroundColor: p.color },
                {
                  opacity: burst.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, p.dy, p.dy + p.fall] }) },
                    { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <Animated.View style={{ opacity: tick, transform: [{ scale: tick.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
                <Ionicons name="checkmark" size={52} color="#fff" />
              </Animated.View>
            </LinearGradient>
          </Animated.View>
        </View>
        <Animated.View style={[styles.copy, { opacity: copy, transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <Text style={styles.title} accessibilityRole="header">Property submitted!</Text>
          <Text style={styles.text}>{message}</Text>
          {children ? <View style={styles.actions}>{children}</View> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const BADGE = 104;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  stage: { width: BADGE, height: BADGE, alignItems: "center", justifyContent: "center" },
  piece: { position: "absolute" },
  ring: { position: "absolute", width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 3, borderColor: brand.violet },
  badge: {
    width: BADGE, height: BADGE, borderRadius: BADGE / 2, alignItems: "center", justifyContent: "center",
    shadowColor: brand.violet, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: brand.ink, marginTop: 30 },
  text: { color: brand.inkSoft, textAlign: "center", lineHeight: 21, fontSize: 14, marginTop: 8 },
  copy: { alignItems: "center", alignSelf: "stretch" },
  actions: { alignSelf: "stretch", gap: 12, marginTop: 28 },
});
