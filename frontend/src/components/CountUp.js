import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { isReducedMotion } from "../hooks/useReducedMotion";
import Text from "./AppText";

// A number that counts from its previous value to the new one (from 0 on first show).
export default function CountUp({ value = 0, duration = 700, format = (n) => n.toLocaleString("en-IN"), style, ...rest }) {
  const target = Number(value) || 0;
  const v = useRef(new Animated.Value(isReducedMotion() ? target : 0)).current;
  const [shown, setShown] = useState(isReducedMotion() ? target : 0);

  useEffect(() => {
    const id = v.addListener(({ value: n }) => setShown(Math.round(n)));
    return () => v.removeListener(id);
  }, [v]);

  useEffect(() => {
    if (isReducedMotion()) {
      v.setValue(target);
      setShown(target);
      return undefined;
    }
    const anim = Animated.timing(v, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [v, target, duration]);

  return (
    <Text style={style} {...rest}>
      {format(shown)}
    </Text>
  );
}
