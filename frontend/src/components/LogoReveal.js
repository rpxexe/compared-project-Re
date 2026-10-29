import React, { useCallback, useEffect, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

const LOGO = require("../../assets/logo_compareprojects.png");

// Stroke paths traced over the original 1254×1254 logo artwork, so the SVG shares the PNG's
// coordinate space and lines up with it at any size. `len` is the analytic path length
// (used for the dash-offset draw-on). The PNG itself is always what the user ends up seeing.
const VB = 1254;
const BUILDING = [
  // Both sides of the tower start at its base so it rises bottom → top.
  { d: "M 690 880 L 610 822 L 610 745 L 543 745 L 543 385 L 687 268", len: 789 },
  { d: "M 690 880 L 690 268", len: 612 },
  { d: "M 610 745 L 610 372", len: 373 },
  { d: "M 595 745 L 595 395", len: 350 },
];
const CURVES = [
  { d: "M 800 210 C 740 190 660 180 580 180 C 441 180 328 301 328 450 C 328 599 430 720 550 720", len: 1020 },
  { d: "M 712 428 L 800 428 C 884 428 952 493 952 573 C 952 654 884 719 800 719 L 712 719", len: 644 },
];
// Monogram ends ~y=880, wordmark starts ~y=930: split there so the wordmark can follow the fill.
const WORDMARK_SPLIT = 905 / VB;

export const REVEAL_DURATION = 1800;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ease = Easing.inOut(Easing.cubic);

// Timeline, as fractions of REVEAL_DURATION.
const T = {
  fadeIn: [0, 0.1],
  building: [0.06, 0.46],
  curves: [0.36, 0.74],
  fill: [0.62, 0.86],
  wordmark: [0.72, 0.94],
  strokesOut: [0.82, 1],
};

const seg = (t, [a, b]) => {
  "worklet";
  return ease(interpolate(t, [a, b], [0, 1], Extrapolation.CLAMP));
};

function NeonStroke({ d, len, progress }) {
  const dash = `${len + 4} ${len + 4}`;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (len + 4) * (1 - progress.value),
  }));
  return (
    <>
      {/* Wide, faint pass = glow; narrow bright pass = the neon tube itself. */}
      <AnimatedPath d={d} fill="none" stroke="#8F3DFF" strokeOpacity={0.28} strokeWidth={34}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} animatedProps={animatedProps} />
      <AnimatedPath d={d} fill="none" stroke="#B26BFF" strokeOpacity={0.7} strokeWidth={16}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} animatedProps={animatedProps} />
      <AnimatedPath d={d} fill="none" stroke="#F1E2FF" strokeWidth={6}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} animatedProps={animatedProps} />
    </>
  );
}

// Draws the CP monogram in neon strokes (building first, then the C and P curves), reveals the
// original PNG logo and wordmark, and settles with a soft glow. Plays once per mount.
export default function LogoReveal({ size, reduced = false, onRevealed }) {
  const t = useSharedValue(0);
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;
  const notify = useCallback(() => onRevealedRef.current?.(), []);

  useEffect(() => {
    if (reduced) {
      // Reduced motion: show the finished logo straight away.
      cancelAnimation(t);
      t.value = 1;
      notify();
      return undefined;
    }
    t.value = withTiming(1, { duration: REVEAL_DURATION, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(notify)();
    });
    return () => cancelAnimation(t);
  }, [reduced, t, notify]);

  const building = useDerivedValue(() => seg(t.value, T.building));
  const curves = useDerivedValue(() => seg(t.value, T.curves));

  const rootStyle = useAnimatedStyle(() => ({ opacity: seg(t.value, T.fadeIn) }));
  const strokesStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(t.value, T.strokesOut) }));
  const fillStyle = useAnimatedStyle(() => {
    const f = seg(t.value, T.fill);
    return { opacity: f, transform: [{ scale: 0.97 + 0.03 * f }] };
  });
  const wordStyle = useAnimatedStyle(() => {
    const w = seg(t.value, T.wordmark);
    return { opacity: w, transform: [{ translateY: (1 - w) * 8 }] };
  });
  // Glow swells as the fill lands, then settles to a gentle resting level.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.5, 0.84, 1], [0, 0.9, 0.5], Extrapolation.CLAMP),
  }));

  const splitH = size * WORDMARK_SPLIT;

  return (
    <Animated.View style={[{ width: size, height: size }, rootStyle]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <Defs>
            <RadialGradient id="cpHalo" cx="620" cy="520" r="560" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#8B3DFF" stopOpacity="0.5" />
              <Stop offset="0.55" stopColor="#6A1FE0" stopOpacity="0.14" />
              <Stop offset="1" stopColor="#6A1FE0" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="620" cy="520" r="560" fill="url(#cpHalo)" />
        </Svg>
      </Animated.View>

      {/* Original artwork, split so the wordmark can arrive just after the monogram fill. */}
      <Animated.View style={[styles.clip, { width: size, height: splitH }, fillStyle]}>
        <Image source={LOGO} style={{ width: size, height: size }} fadeDuration={0} />
      </Animated.View>
      <Animated.View style={[styles.clip, { top: splitH, width: size, height: size - splitH }, wordStyle]}>
        <Image source={LOGO} style={{ width: size, height: size, marginTop: -splitH }} fadeDuration={0} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, strokesStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          {BUILDING.map((p) => (
            <NeonStroke key={p.d} d={p.d} len={p.len} progress={building} />
          ))}
          {CURVES.map((p) => (
            <NeonStroke key={p.d} d={p.d} len={p.len} progress={curves} />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
});
