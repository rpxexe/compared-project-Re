import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { isReducedMotion } from '../hooks/useReducedMotion';
import { useEntrance } from '../hooks/useEntrance';
import { brand, colors, radius, type } from '../theme';
import Text from "./AppText";

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

// Placeholder for one line of text. It takes the line's full height, so nothing jumps when the
// real text arrives, and draws a bar about as tall as the glyphs. Pass the real text's fontSize
// (and lineHeight when the style sets one).
export function SkeletonText({ size = 14, lineHeight = Math.round(size * 1.3), width = '100%', style }) {
  return (
    <View style={[{ height: lineHeight, justifyContent: 'center' }, style]}>
      <Skeleton style={{ height: Math.round(size * 0.8), width, borderRadius: 6 }} />
    </View>
  );
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

// Icon badge that springs in from small, slightly ahead of the text below it.
function PopIcon({ style, children }) {
  const v = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (isReducedMotion()) return;
    Animated.spring(v, { toValue: 1, speed: 10, bounciness: 12, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[styles.iconWrap, style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function EmptyState({ icon = 'search-outline', title, message, action, onAction }) {
  const body = useEntrance(120, 12);
  return (
    <View style={styles.center}>
      <PopIcon><Ionicons name={icon} size={30} color={brand.violet} /></PopIcon>
      <Animated.View style={[styles.body, body]}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.msg}>{message}</Text> : null}
        {action ? <Button title={action} onPress={onAction} small style={{ marginTop: 18 }} /> : null}
      </Animated.View>
    </View>
  );
}

export function ErrorState({ title = 'Unable to load', error, onRetry }) {
  const body = useEntrance(120, 12);
  return (
    <View style={styles.center}>
      <PopIcon style={{ backgroundColor: brand.errorSoft }}><Ionicons name="cloud-offline-outline" size={30} color={colors.error} /></PopIcon>
      <Animated.View style={[styles.body, body]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.msg}>{error?.signInRequired ? 'Please sign in to see this.' : error?.message || 'Something went wrong. Tap to retry.'}</Text>
        {onRetry ? <Button title="Tap to retry" onPress={onRetry} small icon="refresh" style={{ marginTop: 18 }} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28 },
  body: { alignItems: 'center', alignSelf: 'stretch' },
  iconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: brand.lavender, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { ...type.h2, textAlign: 'center' },
  msg: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
