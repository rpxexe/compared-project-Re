import React, { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { brand, colors } from "../../theme";

const THUMB = 26;
const HIT = 44;

// Two-thumb slider over discrete stops. Positions are indices into `steps`, with -1 meaning
// "no minimum" (far left) and steps.length meaning "no maximum" (far right). Values are only
// reported on release, so dragging never triggers a burst of count requests.
export default function DualSlider({ steps, minIndex, maxIndex, onChange, format, label }) {
  const n = steps.length;
  const [width, setWidth] = useState(0);
  const [lo, setLo] = useState(minIndex);
  const [hi, setHi] = useState(maxIndex);
  useEffect(() => setLo(minIndex), [minIndex]);
  useEffect(() => setHi(maxIndex), [maxIndex]);

  // Latest values for the gesture handlers (created once).
  const live = useRef({});
  live.current = { lo, hi, width, n, onChange };

  const toX = (i) => ((i + 1) / (n + 1)) * width;

  const make = (which) => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // keep the drag away from the parent ScrollView
      onPanResponderGrant: () => {
        const c = live.current;
        startX = (((which === "lo" ? c.lo : c.hi) + 1) / (c.n + 1)) * c.width;
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const i = Math.round(((startX + g.dx) / Math.max(c.width, 1)) * (c.n + 1)) - 1;
        if (which === "lo") setLo(Math.max(-1, Math.min(i, c.hi - 1)));
        else setHi(Math.min(c.n, Math.max(i, c.lo + 1)));
      },
      onPanResponderRelease: () => {
        const c = live.current;
        c.onChange(c.lo, c.hi);
      },
    });
  };
  const loPan = useRef(make("lo")).current;
  const hiPan = useRef(make("hi")).current;

  const describe = (i) => (i < 0 ? "No minimum" : i >= n ? "No maximum" : format(steps[i]));
  const step = (which, delta) => {
    if (which === "lo") {
      const i = Math.max(-1, Math.min(lo + delta, hi - 1));
      setLo(i);
      onChange(i, hi);
    } else {
      const i = Math.min(n, Math.max(hi + delta, lo + 1));
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
            <View style={styles.thumb} />
          </View>
          <View {...hiPan.panHandlers} {...a11y("hi")} style={[styles.hit, { left: toX(hi) - HIT / 2 }]}>
            <View style={styles.thumb} />
          </View>
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
});
