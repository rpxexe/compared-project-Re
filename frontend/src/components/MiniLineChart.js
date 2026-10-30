import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { brand } from "../theme";
import Text from "./AppText";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PAD_X = 14; // keeps the end markers inside the plot
const PAD_TOP = 10;
const AXIS_W = 48;

// Smooth curve through the points (monotone-ish cubic: control points at the horizontal midpoints,
// so the line never overshoots between values).
function curve(pts) {
  return pts.reduce((d, p, i) => {
    if (!i) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const mx = (prev.x + p.x) / 2;
    return `${d} C${mx},${prev.y} ${mx},${p.y} ${p.x},${p.y}`;
  }, "");
}

// Single-series line chart for small cards. One hue; the card title names the series, so no legend.
// Draws itself in (line traces left to right, area fades up, markers pop) the first time it scrolls
// into view. Tapping a point moves the crosshair and the readout to its exact value. Screen readers
// get every value in the label.
export default function MiniLineChart({ data, height = 120, color = brand.violet, formatValue = String }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(() => maxIndex(data));
  const host = useRef(null);
  const draw = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const played = useRef(isReducedMotion());

  // Start the draw-in once the chart is actually on screen (Home is long; it usually loads below the fold).
  useEffect(() => {
    if (played.current || !width) return undefined;
    const screenH = Dimensions.get("window").height;
    const id = setInterval(() => {
      host.current?.measureInWindow((x, y, w, h) => {
        if (played.current || !h || y > screenH - 60 || y + h < 0) return;
        played.current = true;
        clearInterval(id);
        Animated.sequence([
          Animated.timing(draw, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false }),
        ]).start();
      });
    }, 250);
    return () => clearInterval(id);
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value));
  // Baseline a little under the smallest value so differences read, without exaggerating them.
  const floor = Math.max(0, min - (max - min) * 0.35);
  const plotW = Math.max(0, width - PAD_X * 2);
  const pts = data.map((d, i) => ({
    x: PAD_X + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2),
    y: PAD_TOP + (1 - (d.value - floor) / (max - floor || 1)) * (height - PAD_TOP - 8),
  }));
  const line = pts.length ? curve(pts) : "";
  const area = pts.length ? `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z` : "";
  // Generous dash length: the curve is never longer than ~1.6x its straight segments.
  const length = pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0) * 1.6 + 1;
  const sel = data[selected] || data[0];
  const sp = pts[selected];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ")}>
      <Text style={styles.readout} numberOfLines={1}>
        <Text style={styles.readoutValue}>{sel ? formatValue(sel.value) : ""}</Text>
        <Text style={styles.readoutLabel}>{sel ? `  ${sel.label}` : ""}</Text>
      </Text>
      <View ref={host} style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && pts.length ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0.5, 1].map((f) => (
              <Line key={f} x1={0} x2={width} y1={height - (height - PAD_TOP) * f} y2={height - (height - PAD_TOP) * f} stroke="#EEE8F8" strokeWidth={1} />
            ))}
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="#DDD5EE" strokeWidth={1} />
            <AnimatedPath d={area} fill="url(#lineFill)" opacity={draw} />
            {sp ? <Line x1={sp.x} x2={sp.x} y1={sp.y} y2={height} stroke={color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3,3" /> : null}
            <AnimatedPath
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${length},${length}`}
              strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] })}
            />
            {pts.map((p, i) => (
              <AnimatedCircle
                key={data[i].label}
                cx={p.x}
                cy={p.y}
                r={pop.interpolate({ inputRange: [0, 1], outputRange: [0, i === selected ? 6 : 4] })}
                fill={i === selected ? color : "#FFFFFF"}
                stroke={i === selected ? "#FFFFFF" : color}
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
        {/* Hit targets: one full-height column per point. */}
        <View style={[StyleSheet.absoluteFill, styles.hitRow]}>
          {data.map((d, i) => (
            <Pressable key={d.label} style={styles.hit} onPress={() => setSelected(i)} accessibilityElementsHidden importantForAccessibility="no" />
          ))}
        </View>
      </View>
      {/* Each label centred under its point. */}
      <View style={styles.axis}>
        {pts.map((p, i) => (
          <Text key={data[i].label} style={[styles.axisLabel, { left: p.x - AXIS_W / 2 }, i === selected && styles.axisOn]} numberOfLines={1}>
            {data[i].short || data[i].label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function maxIndex(data) {
  let best = 0;
  data.forEach((d, i) => {
    if (d.value > (data[best]?.value ?? -1)) best = i;
  });
  return best;
}

const styles = StyleSheet.create({
  readout: { marginBottom: 8 },
  readoutValue: { fontSize: 18, fontWeight: "800", color: brand.ink },
  readoutLabel: { fontSize: 12, color: brand.inkSoft, fontWeight: "600" },
  hitRow: { flexDirection: "row" },
  hit: { flex: 1 },
  axis: { height: 18, marginTop: 6 },
  axisLabel: { position: "absolute", top: 0, width: AXIS_W, textAlign: "center", fontSize: 11, color: brand.inkSoft, fontWeight: "600" },
  axisOn: { color: brand.ink, fontWeight: "800" },
});
