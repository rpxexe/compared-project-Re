import React, { useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Read-only stars show full / half / empty; interactive stars bounce when tapped.
export function Stars({ value = 0, size = 16, gap = 2 }) {
  return (
    <View style={{ flexDirection: 'row', gap }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'} size={size} color={colors.gold} />
      ))}
    </View>
  );
}

function PickStar({ index, active, size, onPick }) {
  const s = useRef(new Animated.Value(1)).current;
  const press = () => {
    onPick(index);
    Animated.sequence([
      Animated.timing(s, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
    ]).start();
  };
  return (
    <Pressable onPress={press} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Rate ${index} star${index > 1 ? 's' : ''}`}>
      <Animated.View style={{ transform: [{ scale: s }] }}>
        <Ionicons name={active ? 'star' : 'star-outline'} size={size} color={active ? colors.gold : '#C6BCE2'} />
      </Animated.View>
    </Pressable>
  );
}

export function StarPicker({ value, onChange, size = 40 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => <PickStar key={i} index={i} active={value >= i} size={size} onPick={onChange} />)}
    </View>
  );
}
