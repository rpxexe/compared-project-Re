import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { isReducedMotion } from "../hooks/useReducedMotion";
import Text from "./AppText";

const GAP = 36; // space between the end of the text and its repeat
const SPEED = 32; // px per second
const PAUSE = 1400; // ms held at the start of each pass

// One line of text that scrolls sideways in a seamless loop when it is wider than its box (a
// second copy follows the first), and sits still otherwise. With "reduce motion" on it is
// truncated instead. Purely visual: give the parent the accessible label.
export default function Marquee({ children, style, containerStyle }) {
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const scrolls = boxW > 0 && textW > boxW + 1 && !isReducedMotion();

  useEffect(() => {
    x.setValue(0);
    if (!scrolls) return undefined;
    const run = textW + GAP;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE),
        Animated.timing(x, { toValue: -run, duration: (run / SPEED) * 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scrolls, textW, x]);

  if (isReducedMotion()) {
    return <Text style={style} numberOfLines={1}>{children}</Text>;
  }

  return (
    <View style={[styles.box, containerStyle]} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {/* The wide track lets the text keep its natural width, so it can be measured. */}
      <Animated.View style={[styles.track, { transform: [{ translateX: x }] }]}>
        <Text style={style} numberOfLines={1} onLayout={(e) => setTextW(e.nativeEvent.layout.width)}>
          {children}
        </Text>
        {scrolls ? <Text style={[style, { marginLeft: GAP }]} numberOfLines={1}>{children}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", alignSelf: "stretch" },
  track: { flexDirection: "row", width: 4000 },
});
