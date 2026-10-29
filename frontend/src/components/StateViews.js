import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { isReducedMotion } from '../hooks/useReducedMotion';
import { brand, colors, radius, type } from '../theme';

export function Skeleton({ style }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (isReducedMotion()) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.45, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: colors.lavender, borderRadius: radius.md, opacity: v }, style]} />;
}

export function LoadingState({ rows = 3, variant = 'row' }) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        variant === 'hero'
          ? <Skeleton key={i} style={{ width: 250, height: 320, borderRadius: radius.xl }} />
          : (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton style={{ width: 112, height: 112 }} />
              <View style={{ flex: 1, gap: 10, paddingTop: 6 }}>
                <Skeleton style={{ height: 14, width: '80%' }} />
                <Skeleton style={{ height: 12, width: '55%' }} />
                <Skeleton style={{ height: 16, width: '40%' }} />
              </View>
            </View>
          )
      ))}
    </View>
  );
}

export function EmptyState({ icon = 'search-outline', title, message, action, onAction }) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}><Ionicons name={icon} size={30} color={brand.violet} /></View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {action ? <Button title={action} onPress={onAction} small style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Unable to load', error, onRetry }) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: brand.errorSoft }]}><Ionicons name="cloud-offline-outline" size={30} color={colors.error} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.msg}>{error?.message || 'Something went wrong. Tap to retry.'}</Text>
      {onRetry ? <Button title="Tap to retry" onPress={onRetry} small icon="refresh" style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28 },
  iconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: brand.lavender, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { ...type.h2, textAlign: 'center' },
  msg: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
