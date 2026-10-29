import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme';

export default function SectionHeader({ title, subtitle, action, onAction, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        <Text style={type.h1}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {action ? <Pressable onPress={onAction} hitSlop={10}><Text style={styles.action}>{action}</Text></Pressable> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 },
  action: { color: colors.goldDeep, fontWeight: '800', fontSize: 13 },
});
