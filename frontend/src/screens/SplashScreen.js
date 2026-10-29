import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import LogoReveal, { REVEAL_DURATION } from "../components/LogoReveal";
import LoadingStroke from "../components/LoadingStroke";
import useReducedMotion from "../hooks/useReducedMotion";

// Start-up overlay: the CompareProjects logo draws itself on black while a neon loading line
// runs beneath it. It leaves only once the logo has settled AND `ready` (app initialisation)
// is true. App.js mounts it once at launch, so it never replays during navigation.
export default function SplashScreen({ ready, onFinish }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const exit = useSharedValue(1);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const size = Math.round(Math.min(W * 0.68, H * 0.42, 360));

  const finish = useCallback(() => finishRef.current?.(), []);
  const leave = useCallback(() => {
    exit.value = withTiming(0, { duration: 360 }, (done) => {
      if (done) runOnJS(finish)();
    });
  }, [exit, finish]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value }));

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="CompareProjects is loading"
    >
      <StatusBar style="light" />
      <View style={styles.center}>
        <LogoReveal size={size} reduced={reduced} onRevealed={() => setRevealed(true)} />
        {/* The artwork has ~16% transparent padding below the wordmark; tuck the line into it. */}
        <LoadingStroke
          width={Math.round(size * 0.62)}
          duration={reduced ? 600 : REVEAL_DURATION - 100}
          ready={ready && revealed}
          onComplete={leave}
          style={{ marginTop: -size * 0.09 }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000", zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
