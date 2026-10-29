import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "./PressableScale";
import { colors, glowSubtle, radius, shadow } from "../theme";

export default function FilterChip({ label, active, onPress, icon, count }) {
  return (
    <PressableScale
      to={0.93}
      onPress={onPress}
      style={[styles.chip, active && glowSubtle]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {active ? (
        <LinearGradient
          colors={["#2A1060", colors.ink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
        />
      ) : (
        <>
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.9)", "rgba(244, 235, 255, 0.65)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
          />
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.98)",
              "rgba(224, 195, 255, 0.4)",
              "rgba(255, 255, 255, 0.05)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
          />
        </>
      )}

      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.ivory : colors.ink}
          style={{ marginRight: 6, zIndex: 1 }}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          active ? { color: colors.ivory } : { color: colors.ink },
        ]}
      >
        {label}
        {count != null ? `  ${count}` : ""}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
    ...shadow.glass,
  },
  text: { fontSize: 13, fontWeight: "700", zIndex: 1 },
});
