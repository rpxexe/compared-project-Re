import React from "react";
import { Animated } from "react-native";
import { useEntrance } from "../hooks/useEntrance";

// Fade + rise on mount. Wrap sections of a screen and step `delay` to stagger them in order.
// With "reduce motion" on, content appears in place immediately (see useEntrance).
export default function Reveal({ delay = 0, distance = 14, style, children, ...rest }) {
  const enter = useEntrance(delay, distance);
  return (
    <Animated.View style={[enter, style]} {...rest}>
      {children}
    </Animated.View>
  );
}

// Delay for the i-th item of a list: quick stagger for the first few, then everything at once.
export const stagger = (i, step = 60, max = 8) => Math.min(i, max) * step;
