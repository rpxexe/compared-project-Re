import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import Text from "../components/AppText";

const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  // show(message, kind, { title }): a title adds a bold first line. An empty message shows nothing,
  // which is how "please sign in" errors stay quiet while the sign-in dialog opens instead.
  const show = useCallback((message, kind = 'info', { title } = {}) => {
    if (!message) return;
    clearTimeout(timer.current);
    setToast({ message, kind, title });
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const stay = title ? 4500 : kind === 'error' ? 3500 : 2600;
    timer.current = setTimeout(() => Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null)), stay);
  }, [anim]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const icon = toast?.kind === 'error' ? 'alert-circle' : toast?.kind === 'success' ? 'checkmark-circle' : 'information-circle';
  const tint = toast?.kind === 'error' ? colors.error : toast?.kind === 'success' ? colors.success : colors.gold;
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <Ionicons name={icon} size={20} color={tint} />
          <View style={{ flex: 1 }}>
            {toast.title ? <Text style={styles.title} numberOfLines={1}>{toast.title}</Text> : null}
            <Text style={styles.text} numberOfLines={4}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 999, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 13, ...shadow.float },
  title: { color: colors.ivory, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  text: { color: colors.ivory, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
});
