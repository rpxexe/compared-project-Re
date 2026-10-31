import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Cover } from "../PropertyCard";
import PressableScale from "../PressableScale";
import { useEntrance } from "../../hooks/useEntrance";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { brand, colors, gradients, radius, shadow } from "../../theme";
import { LinearGradient } from "expo-linear-gradient";
import Text from "../AppText";

const WIN = "#0E9F6E";
const WIN_SOFT = "#E3F7EE";

export const smoothLayout = () => {
  if (!isReducedMotion()) LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
};

// White card with an icon title and a chevron that collapses its body.
export function Section({ title, icon, children }) {
  const [open, setOpen] = useState(true);
  const turn = useRef(new Animated.Value(1)).current;
  const toggle = () => {
    smoothLayout();
    setOpen((o) => !o);
    Animated.timing(turn, { toValue: open ? 0 : 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  return (
    <View style={styles.section}>
      <PressableScale onPress={toggle} to={0.98} style={styles.sectionHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={brand.violet} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "0deg"] }) }] }}>
          <Ionicons name="chevron-up" size={18} color={colors.ink} />
        </Animated.View>
      </PressableScale>
      {open ? children : null}
    </View>
  );
}

// Label column + one column per project. Scrolls sideways only when the columns don't fit.
export function Grid({ items, labelW, colW, fits, children }) {
  const body = (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <View style={[styles.labelCell, { width: labelW }]}>
          <Text style={styles.headLabel}>Project</Text>
        </View>
        {items.map((p) => (
          <View key={p.id} style={[styles.headCell, { width: colW }]}>
            <Cover uri={p.image} style={styles.thumb} iconSize={14} />
            <Text style={styles.headName} numberOfLines={2}>{p.title}</Text>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
  if (fits) return body;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
      {body}
    </ScrollView>
  );
}

// One table row, rising in after the rows above it.
export function Row({ index, label, icon, labelW, last, children }) {
  const enter = useEntrance(Math.min(index, 14) * 45, 10);
  return (
    <Animated.View style={[styles.row, !last && styles.rowLine, enter]}>
      <View style={[styles.labelCell, { width: labelW }]}>
        {icon ? <Ionicons name={icon} size={16} color={brand.violet} /> : null}
        <Text style={styles.label} numberOfLines={2}>{label}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// A value cell. Winners get a soft green fill and a crown that pops in once the row has landed.
export function Cell({ width, text, win, delay = 0, muted, children }) {
  const reduced = isReducedMotion();
  const pop = useRef(new Animated.Value(reduced || !win ? 1 : 0)).current;
  useEffect(() => {
    if (!win || reduced) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, delay: delay + 320, speed: 10, bounciness: 16, useNativeDriver: true }).start();
  }, [win, delay, pop, reduced]);

  return (
    <View style={[styles.cellWrap, { width }]}>
      <Animated.View
        style={[
          styles.cell,
          win && styles.cellWin,
          win && { opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1, 1], extrapolate: "clamp" }) },
        ]}
      >
        {children || (
          <Text style={[styles.value, muted && styles.na, win && styles.valueWin]} numberOfLines={3}>
            {text}
          </Text>
        )}
        {win ? (
          <Animated.View style={{ transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-35deg", "0deg"] }) }] }}>
            <MaterialCommunityIcons name="crown" size={14} color={WIN} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

// "View details" per project; the overall leader's button is filled.
export function DetailsRow({ items, labelW, colW, pick, onOpen }) {
  const enter = useEntrance(320, 10);
  return (
    <Animated.View style={[styles.row, styles.detailsRow, enter]}>
      <View style={{ width: labelW }} />
      {items.map((p, i) => (
        <View key={p.id} style={[styles.cellWrap, { width: colW }]}>
          <PressableScale onPress={() => onOpen(p)} to={0.94} style={[styles.btn, i === pick ? styles.btnOn : null]} accessibilityRole="button" accessibilityLabel={`View details of ${p.title}`}>
            {i === pick ? (
              <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            ) : null}
            <Text style={[styles.btnText, i === pick && { color: colors.white }]} numberOfLines={1}>View Details</Text>
          </PressableScale>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(124, 44, 245, 0.08)",
    overflow: "hidden",
    ...shadow.card,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FAF7FF",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.3,
    borderColor: "rgba(124, 44, 245, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  labelCell: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 6 },
  headLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  headCell: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 5, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  thumb: { width: 30, height: 30, borderRadius: 15 },
  headName: { flex: 1, fontSize: 11.5, lineHeight: 15, fontWeight: "800", color: colors.ink },
  label: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.ink },
  cellWrap: { paddingHorizontal: 4, alignSelf: "stretch", justifyContent: "center", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  cell: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 7, borderRadius: 8 },
  cellWin: { backgroundColor: WIN_SOFT },
  value: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.ink, fontWeight: "600" },
  valueWin: { color: "#0B7A55", fontWeight: "800" },
  na: { color: "#B5AFBB", fontWeight: "500" },
  detailsRow: { paddingVertical: 10 },
  btn: {
    height: 34,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: "rgba(124, 44, 245, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  btnOn: { borderColor: brand.violet },
  btnText: { fontSize: 11.5, fontWeight: "800", color: brand.violet },
});
