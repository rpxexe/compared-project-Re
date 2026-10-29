import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import PressableScale from "./PressableScale";
import { colors, radius, shadow } from "../theme";

// Editable by default; pass `onPress` to use it as a tappable shortcut (Home → Search).
export default function SearchBar({
  editable = true,
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search city, locality, project, developer",
  onPress,
  onFilter,
  filterCount = 0,
  autoFocus,
}) {
  const Inner = (
    <View style={styles.box}>
      {/* Frosted Liquid Glass layers */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius.pill, overflow: "hidden" },
        ]}
        pointerEvents="none"
      >
        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.88)", "rgba(244, 235, 255, 0.65)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0.98)",
            "rgba(224, 195, 255, 0.4)",
            "rgba(255, 255, 255, 0.05)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Ionicons name="search" size={19} color={colors.goldDeep} />
      {onPress ? (
        <View style={{ flex: 1 }}>
          <TextInput
            editable={false}
            pointerEvents="none"
            placeholder={placeholder}
            placeholderTextColor="#A9A3B0"
            style={styles.input}
          />
        </View>
      ) : (
        <TextInput
          editable={editable}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor="#A9A3B0"
          style={styles.input}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
        />
      )}
      {!onPress && value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color="#B9B2BE" />
        </Pressable>
      ) : null}
      {onFilter ? (
        <PressableScale
          onPress={onFilter}
          to={0.92}
          style={styles.filter}
          accessibilityLabel="Filters"
        >
          <Ionicons name="options-outline" size={18} color={colors.ivory} />
          {filterCount > 0 ? (
            <View style={styles.dot}>
              <View style={styles.dotIn} />
            </View>
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} to={0.98} accessibilityRole="search">
      {Inner}
    </PressableScale>
  ) : (
    Inner
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: radius.pill,
    paddingLeft: 16,
    paddingRight: 6,
    height: 54,
    gap: 10,
    borderWidth: 1.4,
    borderColor: "rgba(255, 255, 255, 0.98)",
    position: "relative",
    ...shadow.glassFloat,
  },
  input: { flex: 1, fontSize: 14.5, color: colors.ink, paddingVertical: 0, zIndex: 1 },
  filter: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dotIn: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.rose },
});
