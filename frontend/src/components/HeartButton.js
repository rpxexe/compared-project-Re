import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { colors, shadow } from '../theme';
import { useSaved } from '../context/SavedContext';

export default function HeartButton({ id, size = 20, floating = true, style }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(id);
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(s, {
        toValue: saved ? 1.45 : 0.78,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.spring(s, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 18,
        speed: 20,
      }),
    ]).start();
  }, [saved, s]);

  return (
    <PressableScale
      onPress={(e) => {
        e?.stopPropagation?.();
        toggle(id);
      }}
      to={0.88}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save property'}
      style={[floating && styles.float, style]}
    >
      {floating ? (
        <>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0.72)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 19 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 19 }]}
            pointerEvents="none"
          />
        </>
      ) : null}
      <Animated.View style={{ transform: [{ scale: s }], zIndex: 1 }}>
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={size}
          color={saved ? colors.rose : floating ? colors.ink : colors.muted}
        />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  float: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadow.glass,
  },
});
