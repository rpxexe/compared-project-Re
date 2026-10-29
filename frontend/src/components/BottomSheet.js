import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from './PressableScale';
import { colors, fonts, radius, shadow } from '../theme';

export default function BottomSheet({ visible, onClose, title, children, maxHeight = 0.88 }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(y, { toValue: Dimensions.get('window').height, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11, 4, 32, 0.62)", opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { maxHeight: `${maxHeight * 100}%`, paddingBottom: Math.max(insets.bottom, 12) + 8, transform: [{ translateY: y }] }]}>
          {/* Frosted Glass Layers */}
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.96)", "rgba(246, 242, 255, 0.92)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.gradientRadius]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.85)", "rgba(255, 255, 255, 0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={[StyleSheet.absoluteFill, styles.gradientRadius]}
            pointerEvents="none"
          />

          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <PressableScale onPress={onClose} to={0.88} hitSlop={10} style={styles.x}>
              <Ionicons name="close" size={19} color={colors.ink} />
            </PressableScale>
          </View>
          <View style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    position: 'relative',
    ...shadow.glassFloat,
  },
  gradientRadius: {
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(199, 125, 255, 0.4)',
    marginBottom: 12,
    zIndex: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, zIndex: 1 },
  title: { flex: 1, fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  x: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(235, 226, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
