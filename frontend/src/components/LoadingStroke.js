import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const HEAD = 44;

// Thin neon line that fills left → right with a bright highlight riding its leading edge.
// - First pass reaches ~90% in `duration` ms (paired with the logo reveal).
// - If `ready` hasn't arrived by then, it keeps creeping forward so it never looks stalled.
// - When `ready` turns true it completes and calls `onComplete`.
export default function LoadingStroke({ width, ready, duration = 1700, onComplete, style }) {
  const p = useSharedValue(0);
  const pulse = useSharedValue(1);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const complete = useCallback(() => onCompleteRef.current?.(), []);

  useEffect(() => {
    p.value = withTiming(0.9, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      // Still waiting on start-up: keep moving, ever more slowly, without reaching the end.
      if (finished) p.value = withTiming(0.985, { duration: 9000, easing: Easing.out(Easing.quad) });
    });
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(p);
      cancelAnimation(pulse);
    };
  }, [duration, p, pulse]);

  useEffect(() => {
    if (!ready) return;
    // Replacing the running timing cancels it (its callback gets finished=false).
    p.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(complete)();
    });
  }, [ready, p, complete]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (p.value - 1) * width }],
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: p.value > 0.01 ? pulse.value : 0,
    transform: [{ translateX: p.value * width - HEAD / 2 }],
  }));

  return (
    <View
      style={[{ width, height: 14, justifyContent: "center" }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Soft glow underneath the line (works on Android, where coloured shadows don't). */}
      <View style={[styles.glowTrack, { width }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <LinearGradient colors={["rgba(124,44,245,0)", "rgba(178,107,255,0.45)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View style={[styles.track, { width }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <LinearGradient colors={["#5F1BD8", "#9B4DFF", "#C99BFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.head, headStyle]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(201,155,255,0)", "rgba(201,155,255,0.55)", "rgba(201,155,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headGlow}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0)", "#F6ECFF", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headCore}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    left: 0,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "rgba(178,107,255,0.16)",
  },
  glowTrack: { position: "absolute", left: 0, height: 8, borderRadius: 4, overflow: "hidden", opacity: 0.6 },
  head: { position: "absolute", left: 0, width: HEAD, height: 14, justifyContent: "center" },
  headGlow: { position: "absolute", left: 0, right: 0, height: 12, borderRadius: 6 },
  headCore: { height: 3, borderRadius: 1.5, shadowColor: "#D9B8FF", shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
