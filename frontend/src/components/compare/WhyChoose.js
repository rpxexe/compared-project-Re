import React, { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "../PressableScale";
import { useEntrance } from "../../hooks/useEntrance";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { colors, radius, shadow } from "../../theme";
import Text from "../AppText";
import { INSIGHT_STYLE } from "./insightStyle";

// Quick verdicts ("Best Price", "Most Spacious", ...) computed from the compared listings.
export default function WhyChoose({ insights, items, tileW, onOpen }) {
  const enter = useEntrance(380, 16);
  if (!insights.length) return null;
  return (
    <Animated.View style={[styles.wrap, enter]}>
      <Text style={styles.title}>Why Choose?</Text>
      <Text style={styles.sub}>Quick insights to help you decide</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {insights.map((ins, i) => (
          <Tile key={ins.key} ins={ins} p={items[ins.index]} index={i} width={tileW} onOpen={onOpen} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function Tile({ ins, p, index, width, onOpen }) {
  const look = INSIGHT_STYLE[ins.key];
  const v = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay: 480 + index * 110, speed: 10, bounciness: 9, useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        width,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
      }}
    >
      <PressableScale onPress={() => onOpen(p)} to={0.95} style={styles.tile} accessibilityRole="button" accessibilityLabel={`${ins.title}: ${p.title}, ${ins.value}`}>
        <Animated.View style={[styles.icon, { backgroundColor: look.soft, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
          <Ionicons name={look.icon} size={19} color={look.color} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle} numberOfLines={1}>{ins.title}</Text>
          <Text style={styles.name} numberOfLines={1}>{p.title}</Text>
          <Text style={[styles.value, { color: look.color }]} numberOfLines={1}>{ins.value}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: "#F1EBFF",
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.10)",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink, paddingHorizontal: 14 },
  sub: { fontSize: 11.5, color: colors.muted, marginTop: 2, paddingHorizontal: 14 },
  row: { paddingHorizontal: 12, gap: 8, paddingTop: 10, paddingBottom: 4 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontSize: 11.5, fontWeight: "800", color: colors.ink },
  name: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  value: { fontSize: 12, fontWeight: "800", marginTop: 2 },
});
