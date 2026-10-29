import React from "react";
import { Animated } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path } from "react-native-svg";

// CP monogram drawn as three strokes: C arc, vertical stem, P bowl.
// Geometry is on a 200x200 grid; lengths are analytic so dash animations are exact.
export const CP = {
  c: { d: "M122.71 54.63 A54 54 0 1 0 122.71 137.37", len: 246, w: 13 },
  stem: { d: "M140 172 L140 36", len: 137, w: 8 },
  bowl: { d: "M140 62 A29 29 0 0 1 140 120", len: 92, w: 10 },
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// `p` is either a number 0..1 (static) or an Animated.Value / interpolation.
function Stroke({ shape, p, width, stroke, opacity = 1 }) {
  const animated = typeof p !== "number";
  const offset = animated
    ? p.interpolate({ inputRange: [0, 1], outputRange: [shape.len + 3, 0] })
    : (shape.len + 3) * (1 - p);
  const Comp = animated ? AnimatedPath : Path;
  return (
    <Comp
      d={shape.d}
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={`${shape.len + 3} ${shape.len + 3}`}
      strokeDashoffset={offset}
    />
  );
}

export default function CPMark({ size = 120, c = 1, stem = 1, bowl = 1, glow = true, gradientId = "cpGrad" }) {
  const parts = [
    ["c", c],
    ["stem", stem],
    ["bowl", bowl],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <SvgGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="40" y1="30" x2="160" y2="172">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E2D2FF" />
        </SvgGradient>
      </Defs>
      {glow
        ? parts.map(([k, p]) => (
            <React.Fragment key={`g${k}`}>
              <Stroke shape={CP[k]} p={p} width={CP[k].w + 22} stroke="#A66BFF" opacity={0.18} />
              <Stroke shape={CP[k]} p={p} width={CP[k].w + 10} stroke="#C77DFF" opacity={0.32} />
            </React.Fragment>
          ))
        : null}
      {parts.map(([k, p]) => (
        <Stroke key={k} shape={CP[k]} p={p} width={CP[k].w} stroke={`url(#${gradientId})`} />
      ))}
    </Svg>
  );
}
