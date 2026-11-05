import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { brand, colors, shadow } from "../../theme";
import Text from "../AppText";

const THUMB = 26;
const HIT = 44;
const ARROW = 8;

// Two-thumb slider over discrete stops. Positions are indices into `steps`, with -1 meaning
// "no minimum" (far left) and steps.length meaning "no maximum" (far right). Values are only
// reported on release, so dragging never triggers a burst of count requests - meanwhile a bubble
// above the held thumb shows the value it would set. `openTop`: the far right reads "<top step>+"
// and stands in for the top step, so the maximum thumb never stops on the plain top step.
export default function DualSlider({ steps, minIndex, maxIndex, onChange, format, label, openTop = false }) {
  const n = steps.length;
  const [width, setWidth] = useState(0);
  const [lo, setLo] = useState(minIndex);
  const [hi, setHi] = useState(maxIndex);
  useEffect(() => setLo(minIndex), [minIndex]);
  useEffect(() => setHi(maxIndex), [maxIndex]);

  // The held thumb ("lo" | "hi"); it stays set while the bubble fades out after release.
  const [held, setHeld] = useState(null);
  const show = useRef(new Animated.Value(0)).current;
  const [bubbleW, setBubbleW] = useState(0);

  // Latest values for the gesture handlers (created once).
  const live = useRef({});
  live.current = { lo, hi, width, n, onChange, openTop };
  // The maximum thumb's stop: with an open top, the plain top step jumps to the open end.
  const hiStop = (i, c = live.current) => (c.openTop && i === c.n - 1 ? c.n : i);

  const toX = (i) => ((i + 1) / (n + 1)) * width;

  const grab = (which) => {
    setHeld(which);
    if (isReducedMotion()) return show.setValue(1);
    Animated.spring(show, { toValue: 1, speed: 20, bounciness: 10, useNativeDriver: true }).start();
  };
  const letGo = () => {
    if (isReducedMotion()) {
      show.setValue(0);
      setHeld(null);
      return;
    }
    Animated.timing(show, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setHeld(null);
    });
  };

  const make = (which) => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // keep the drag away from the parent ScrollView
      onPanResponderGrant: () => {
        const c = live.current;
        startX = (((which === "lo" ? c.lo : c.hi) + 1) / (c.n + 1)) * c.width;
        grab(which);
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const i = Math.round(((startX + g.dx) / Math.max(c.width, 1)) * (c.n + 1)) - 1;
        if (which === "lo") setLo(Math.max(-1, Math.min(i, c.hi - 1)));
        else setHi(hiStop(Math.min(c.n, Math.max(i, c.lo + 1)), c));
      },
      onPanResponderRelease: () => {
        const c = live.current;
        letGo();
        c.onChange(c.lo, c.hi);
      },
      onPanResponderTerminate: () => letGo(),
    });
  };
  const loPan = useRef(make("lo")).current;
  const hiPan = useRef(make("hi")).current;

  const topLabel = openTop ? `${format(steps[n - 1])}+` : "No max";
  // Bubble over the held thumb, kept inside the slider's edges; its arrow still points at the thumb.
  const heldX = held ? toX(held === "lo" ? lo : hi) : 0;
  const bubbleLeft = Math.min(Math.max(heldX - bubbleW / 2, -THUMB / 2), width + THUMB / 2 - bubbleW);
  const bubbleText = held === "lo" ? (lo < 0 ? "No min" : format(steps[lo])) : hi >= n ? topLabel : format(steps[Math.min(hi, n - 1)]);
  const grow = { transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] };
  const thumbStyle = (which) => [styles.thumb, held === which && styles.thumbHeld];

  const describe = (i) => (i < 0 ? "No minimum" : i >= n ? (openTop ? topLabel : "No maximum") : format(steps[i]));
  const step = (which, delta) => {
    if (which === "lo") {
      const i = Math.max(-1, Math.min(lo + delta, hi - 1));
      setLo(i);
      onChange(i, hi);
    } else {
      let i = Math.min(n, Math.max(hi + delta, lo + 1));
      // Stepping down off the open top skips the plain top step too (when the minimum allows).
      if (openTop && i === n - 1) i = delta < 0 && lo < n - 2 ? n - 2 : n;
      setHi(i);
      onChange(lo, i);
    }
  };
  const a11y = (which) => ({
    accessible: true,
    accessibilityRole: "adjustable",
    accessibilityLabel: `${which === "lo" ? "Minimum" : "Maximum"} ${label}`,
    accessibilityValue: { text: describe(which === "lo" ? lo : hi) },
    accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
    onAccessibilityAction: (e) => step(which, e.nativeEvent.actionName === "increment" ? 1 : -1),
  });

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.track} />
      {width ? (
        <>
          <View style={[styles.fill, { left: toX(lo), width: Math.max(0, toX(hi) - toX(lo)) }]} />
          <View {...loPan.panHandlers} {...a11y("lo")} style={[styles.hit, { left: toX(lo) - HIT / 2 }]}>
            <Animated.View style={[thumbStyle("lo"), held === "lo" && grow]} />
          </View>
          <View {...hiPan.panHandlers} {...a11y("hi")} style={[styles.hit, { left: toX(hi) - HIT / 2 }]}>
            <Animated.View style={[thumbStyle("hi"), held === "hi" && grow]} />
          </View>
          {held ? (
            // Purely visual: the thumbs already announce their values to screen readers.
            <Animated.View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              onLayout={(e) => setBubbleW(e.nativeEvent.layout.width)}
              style={[
                styles.bubble,
                {
                  left: bubbleLeft,
                  opacity: bubbleW ? show : 0,
                  transform: [
                    { translateY: show.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                    { scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.bubbleText} numberOfLines={1}>{bubbleText}</Text>
              <View style={[styles.arrow, { left: heldX - bubbleLeft - ARROW / 2 }]} />
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// Inverse helpers for callers: value <-> index.
export const minToIndex = (steps, v) => (v == null ? -1 : Math.max(0, steps.findIndex((s) => s >= v)));
export const maxToIndex = (steps, v) => {
  if (v == null) return steps.length;
  const i = steps.findIndex((s) => s >= v);
  return i < 0 ? steps.length - 1 : i;
};

const styles = StyleSheet.create({
  wrap: { height: HIT, justifyContent: "center", marginHorizontal: THUMB / 2 },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.line },
  fill: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: brand.violet },
  hit: { position: "absolute", width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: brand.violet,
  },
  thumbHeld: { borderWidth: 3, backgroundColor: brand.lavender },
  // Sits just above the thumb; the slider rows above it are drawn first, so it floats over them.
  bubble: {
    position: "absolute",
    bottom: HIT / 2 + THUMB / 2 + ARROW,
    paddingHorizontal: 10,
    height: 28,
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: brand.violet,
    ...shadow.card,
  },
  bubbleText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  // A square turned 45 degrees, half tucked under the bubble, as its pointer.
  arrow: {
    position: "absolute",
    bottom: -ARROW / 2,
    width: ARROW,
    height: ARROW,
    backgroundColor: brand.violet,
    transform: [{ rotate: "45deg" }],
  },
});
