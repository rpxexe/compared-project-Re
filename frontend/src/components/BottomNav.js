import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { colors, radius } from "../theme";
import { useAuth } from "../context/AuthContext";
import { isReducedMotion } from "../hooks/useReducedMotion";

// Four tabs, in the order requested: Home | Compare Project | Post Property | New Project.
const TABS = {
  Home: {
    label: "Home",
    icon: (on, c) => (
      <Ionicons name={on ? "home" : "home-outline"} size={22} color={c} />
    ),
  },
  Explore: {
    label: "Explore",
    icon: (on, c) => (
      <Ionicons name={on ? "search" : "search-outline"} size={22} color={c} />
    ),
  },
  Post: { label: "", icon: null },
  Compare: {
    label: "Compare",
    icon: (on, c) => (
      <Ionicons name={on ? "layers" : "layers-outline"} size={22} color={c} />
    ),
  },
  Profile: {
    label: "Profile",
    icon: (on, c) => (
      <Ionicons name={on ? "person" : "person-outline"} size={22} color={c} />
    ),
  },
  NewProject: {
    label: "Projects",
    icon: (on, c) => (
      <MaterialCommunityIcons
        name={on ? "office-building" : "office-building-outline"}
        size={23}
        color={c}
      />
    ),
  },
};

function TabItem({ name, focused, onPress, onLongPress, badge }) {
  const cfg = TABS[name] || { label: name, icon: () => null };
  const p = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(p, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
    if (focused && !isReducedMotion()) {
      bounce.setValue(0);
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -4,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(bounce, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 18,
        }),
      ]).start();
    }
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconScale = p.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const pillScale = p.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const activePurple = colors.primary || "#7C3AED";
  const color = focused ? activePurple : "#8A82A3";
  const isPost = name === "Post";
  const spin = p.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={cfg.label || "Post"}
    >
      <Animated.View
        style={{ transform: [{ translateY: bounce }, { scale: iconScale }] }}
      >
        {isPost ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <LinearGradient
              colors={["#A855F7", "#7C3AED", "#6D28D9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.plus}
            >
              <Ionicons name="add" size={30} color={colors.white} />
            </LinearGradient>
          </Animated.View>
        ) : (
          <View style={styles.iconBox}>
            <Animated.View
              style={[
                styles.pill,
                { opacity: p, transform: [{ scale: pillScale }] },
              ]}
            />
            {cfg.icon ? cfg.icon(focused, color) : null}
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Animated.View>
      {cfg.label ? (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: focused ? activePurple : "#8A82A3",
              fontWeight: focused ? "800" : "600",
            },
          ]}
        >
          {cfg.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function BottomNav({ state, navigation, badges = {} }) {
  const insets = useSafeAreaInsets();
  const { token, openLoginPrompt } = useAuth();
  return (
    <View style={[styles.barWrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Real Frosted Blur View */}
      <BlurView
        intensity={70}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      {/* Frosted Glass background layers */}
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.72)", "rgba(246, 242, 255, 0.58)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Top Specular Liquid Sheen Highlight */}
      <View style={styles.specularLine} pointerEvents="none">
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0.98)",
            "rgba(224, 195, 255, 0.65)",
            "rgba(255, 255, 255, 0.98)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const onPress = () => {
          if (route.name === "Post" && !token) {
            openLoginPrompt({
              reason: "post_property",
              title: "Sign In to List Property",
              message: "Post your property to reach thousands of genuine buyers and investors. Please sign in or register to continue.",
            });
            return;
          }
          const ev = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TabItem
            key={route.key}
            name={route.name}
            focused={focused}
            onPress={onPress}
            onLongPress={() =>
              navigation.emit({ type: "tabLongPress", target: route.key })
            }
            badge={badges[route.name]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.4,
    borderTopColor: "rgba(255, 255, 255, 0.98)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255, 255, 255, 0.7)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.7)",
    paddingTop: 8,
    shadowColor: "#140A2E",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
    position: "relative",
    overflow: "hidden",
  },
  specularLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 58,
  },
  iconBox: {
    width: 52,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    width: 52,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "rgba(235, 226, 255, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(166, 107, 255, 0.45)",
    shadowColor: colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  plus: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: colors.goldDeep,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  label: { fontSize: 10.5, marginTop: 3, letterSpacing: 0.1 },
  badge: {
    position: "absolute",
    top: -3,
    right: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.rose,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: "800" },
});
