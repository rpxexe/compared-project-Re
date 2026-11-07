import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isReducedMotion } from '../hooks/useReducedMotion';
import { brand, colors, radius, shadow } from '../theme';
import Text from "../components/AppText";

const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);

// Look of each kind: badge icon, gradient for the badge, soft tint behind it, and the title used
// when show() isn't given one.
const KINDS = {
  success: { icon: 'checkmark-done', colors: ['#34D399', '#059669'], soft: '#E3F7EE', title: 'Done' },
  error: { icon: 'close', colors: ['#FB7185', '#DC2626'], soft: '#FDECEC', title: 'Something went wrong' },
  warning: { icon: 'alert', colors: ['#FCD34D', '#D97706'], soft: '#FFF5DC', title: 'Heads up' },
  info: { icon: 'notifications', colors: ['#A66BFF', '#6D28D9'], soft: brand.lavender, title: 'Notice' },
};

// One toast card. It plays its own entrance (drop in + icon pop), counts down with a progress
// bar, and animates out before telling the provider it's gone. Swipe up or tap to dismiss.
function ToastCard({ toast, top, onDone }) {
  const kind = KINDS[toast.kind] || KINDS.info;
  const reduced = isReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const badge = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const timer = useRef(null);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    clearTimeout(timer.current);
    progress.stopAnimation();
    Animated.timing(enter, { toValue: 0, duration: reduced ? 0 : 200, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => onDone(toast.id));
  }, [enter, progress, onDone, toast.id, reduced]);

  useEffect(() => {
    // Toasts with a button stay a little longer so there's time to reach it.
    const stay = toast.title || toast.action ? 4500 : toast.kind === 'error' ? 3800 : 2800;
    timer.current = setTimeout(leave, stay);
    Animated.timing(progress, { toValue: 0, duration: stay, easing: Easing.linear, useNativeDriver: true }).start();
    if (!reduced) {
      Animated.spring(enter, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(badge, { toValue: 1, speed: 10, bounciness: 16, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      // Errors and warnings get a short head-shake on the badge; others a little tilt.
      const shakes = toast.kind === 'error' || toast.kind === 'warning' ? [-9, 9, -6, 6, -3, 0] : [-12, 0];
      Animated.sequence([
        Animated.delay(300),
        ...shakes.map((v) => Animated.timing(wiggle, { toValue: v, duration: 60, useNativeDriver: true })),
      ]).start();
    }
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag up to dismiss; a short drag springs back.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => drag.setValue(Math.min(g.dy, 12)),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -30 || g.vy < -0.6) leave();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const cardStyle = {
    top,
    opacity: enter.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }), drag) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.wrap, cardStyle]} {...pan.panHandlers}>
      <Pressable onPress={leave} style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <View style={styles.badgeWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, {
              borderColor: kind.colors[1],
              opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
            }]}
          />
          <View style={[styles.badgeSoft, { backgroundColor: kind.soft }]}>
            <Animated.View style={{
              transform: [
                { scale: badge },
                { rotate: wiggle.interpolate({ inputRange: [-12, 12], outputRange: ['-12deg', '12deg'] }) },
              ],
            }}>
              <LinearGradient colors={kind.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                <Ionicons name={kind.icon} size={17} color={colors.white} />
              </LinearGradient>
            </Animated.View>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{toast.title || kind.title}</Text>
          <Text style={styles.text} numberOfLines={4}>{toast.message}</Text>
        </View>

        {toast.action ? (
          <Pressable
            onPress={() => { leave(); toast.action.onPress(); }}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
          >
            <Text style={styles.actionText}>{toast.action.label}</Text>
            <Ionicons name="arrow-forward" size={13} color={brand.violet} />
          </Pressable>
        ) : (
          <Ionicons name="close" size={16} color={brand.placeholder} accessibilityLabel="Dismiss" />
        )}

        {/* Time left before it closes by itself. */}
        <View style={styles.track} pointerEvents="none">
          <Animated.View style={[styles.bar, { backgroundColor: kind.colors[1], transform: [{ scaleX: progress }] }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const seq = useRef(0);
  const insets = useSafeAreaInsets();

  // show(message, kind, { title, action }): kind is success | error | warning | info. A title
  // replaces the default heading; `action` ({ label, onPress }) adds a button that runs it and
  // closes the toast. An empty message shows nothing, which is how "please sign in" errors stay
  // quiet while the sign-in dialog opens. A new toast replaces the one on screen.
  const show = useCallback((message, kind = 'info', { title, action } = {}) => {
    if (!message) return;
    seq.current += 1;
    setToast({ id: seq.current, message, kind, title, action });
  }, []);
  const done = useCallback((id) => setToast((t) => (t && t.id === id ? null : t)), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} top={insets.top + 10} onDone={done} /> : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 999 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingLeft: 12, paddingRight: 14, paddingTop: 12, paddingBottom: 14,
    borderWidth: 1, borderColor: 'rgba(124, 44, 245, 0.08)', overflow: 'hidden',
    ...shadow.glassFloat,
  },
  badgeWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  badgeSoft: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  text: { color: brand.inkSoft, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 1 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32, paddingHorizontal: 11,
    borderRadius: radius.pill, backgroundColor: brand.lavender,
  },
  actionText: { color: brand.violet, fontSize: 12.5, fontWeight: '800' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(124, 44, 245, 0.06)' },
  bar: { height: 3, width: '100%', transformOrigin: 'left' },
});
