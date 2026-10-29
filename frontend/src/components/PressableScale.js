import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({ children, style, to = 0.96, onPress, disabled, hitSlop, ...rest }) {
  const s = useRef(new Animated.Value(1)).current;
  const spring = (v) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      onPressIn={() => spring(to)}
      onPressOut={() => spring(1)}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, { transform: [{ scale: s }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
