import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PressableScale from './PressableScale';
import GlassView from './GlassView';
import { colors, type } from '../theme';
import Text from "./AppText";

export default function ScreenHeader({ title, subtitle, back, right, style }) {
  const nav = useNavigation();
  return (
    <View style={[styles.row, style]}>
      {back && nav.canGoBack() ? (
        <PressableScale
          onPress={() => nav.goBack()}
          to={0.9}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <GlassView level="regular" blur borderRadius={22} style={styles.back}>
            <Ionicons name="chevron-back" size={21} color={colors.ink} />
          </GlassView>
        </PressableScale>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.h1} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
