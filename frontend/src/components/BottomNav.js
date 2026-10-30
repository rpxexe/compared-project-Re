import React, { useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightCallbackContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { brand, colors, gradients } from "../theme";
import { useAuth } from "../context/AuthContext";
import { isReducedMotion } from "../hooks/useReducedMotion";
import Text from "./AppText";

// Bar geometry. The active tab's icon sits in a floating bubble that rests in a notch cut
// into the bar's top edge; both slide to the tapped tab.
const BAR_H = 66;
const BAR_RADIUS = 22;
const GUTTER = 12;
const BUBBLE_R = 26;
const BUBBLE_Y = 2; // bubble centre, measured down from the bar's top edge
const NOTCH_R = 34; // half-width of the bowl
const NOTCH_SHOULDER = 12; // smoothing where the bowl meets the flat edge
const NOTCH_DEPTH = 36;

const MUTED = "#8A82A3";

// Chemical-equilibrium arrow (⇌): two half-headed arrows pointing opposite ways.
function EquilibriumIcon({ size = 22, color, bold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9H20L15 4M20 15H4L9 20"
        stroke={color}
        strokeWidth={bold ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const TABS = {
  Home: {
    label: "Home",
    icon: (on, c) => <Ionicons name={on ? "home" : "home-outline"} size={22} color={c} />,
  },
  Explore: {
    label: "Search",
    icon: (on, c) => <Ionicons name={on ? "search" : "search-outline"} size={22} color={c} />,
  },
  Post: {
    label: "Post",
    icon: (on, c) => <Ionicons name={on ? "add-circle" : "add-circle-outline"} size={24} color={c} />,
  },
  Compare: {
    label: "Compare",
    icon: (on, c) => <EquilibriumIcon color={c} bold={on} />,
  },
  Profile: {
    label: "Profile",
    icon: (on, c) => <Ionicons name={on ? "person" : "person-outline"} size={22} color={c} />,
  },
  NewProject: {
    label: "Projects",
    icon: (on, c) => (
      <MaterialCommunityIcons name={on ? "office-building" : "office-building-outline"} size={23} color={c} />
    ),
  },
};

const tabConfig = (name) => TABS[name] || { label: name, icon: () => null };

// Bar fill for an SVG of `width`, with the notch centred at `cx`.
function notchPath(width, cx) {
  const l = cx - NOTCH_R - NOTCH_SHOULDER;
  const r = cx + NOTCH_R + NOTCH_SHOULDER;
  return [
    `M0 0 H${l}`,
    `C${cx - NOTCH_R} 0 ${cx - NOTCH_R} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH}`,
    `C${cx + NOTCH_R} ${NOTCH_DEPTH} ${cx + NOTCH_R} 0 ${r} 0`,
    `H${width} V${BAR_H} H0 Z`,
  ].join(" ");
}

function TabItem({ name, focused, onPress, onLongPress, badge }) {
  const cfg = tabConfig(name);
  const p = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (isReducedMotion()) {
      p.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(p, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 8, tension: 120 }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // The active tab's icon rises into the bubble and fades out of its slot.
  const slot = {
    opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
    ],
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.item, pressed && !focused && styles.itemPressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${cfg.label}, ${badge}` : cfg.label}
    >
      <Animated.View style={[styles.iconBox, slot]}>
        {cfg.icon(false, MUTED)}
        {badge ? <Badge value={badge} /> : null}
      </Animated.View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, focused && styles.labelOn]}>
        {cfg.label}
      </Text>
    </Pressable>
  );
}

function Badge({ value, style }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{value}</Text>
    </View>
  );
}

export default function BottomNav({ state, navigation, badges = {} }) {
  const insets = useSafeAreaInsets();
  const { token, openLoginPrompt } = useAuth();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current; // notch / bubble centre within the bar
  const pop = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);

  const count = state.routes.length;
  const active = state.routes[state.index]?.name;
  const activeCfg = tabConfig(active);

  useEffect(() => {
    if (!width) return;
    const to = ((state.index + 0.5) * width) / count;
    // First layout (and reduced motion) snaps into place; afterwards the bubble travels.
    if (!placed.current || isReducedMotion()) {
      placed.current = true;
      x.setValue(to);
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: to, useNativeDriver: true, friction: 9, tension: 70 }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.82, duration: 110, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4, tension: 160 }),
      ]),
    ]).start();
  }, [state.index, width, count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Floats over the screens; they read its height (useBottomTabBarHeight) to keep content clear.
    <View
      pointerEvents="box-none"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {/* Solid strip behind the phone's own navigation buttons, so content never scrolls under them. */}
      {insets.bottom ? <View pointerEvents="none" style={[styles.systemNavFill, { height: insets.bottom }]} /> : null}
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          // Twice the bar's width with the notch in the middle, slid so the notch tracks `x`.
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { width: width * 2, transform: [{ translateX: Animated.subtract(x, width) }] }]}
          >
            <Svg width={width * 2} height={BAR_H}>
              <Path d={notchPath(width * 2, width)} fill={colors.white} stroke="rgba(124, 44, 245, 0.10)" strokeWidth={1} />
            </Svg>
          </Animated.View>
        ) : null}

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
            const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TabItem
              key={route.key}
              name={route.name}
              focused={focused}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              badge={badges[route.name]}
            />
          );
        })}
      </View>

      {width ? (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.bubbleWrap, { transform: [{ translateX: Animated.subtract(x, BUBBLE_R) }, { scale: pop }] }]}
        >
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
            {activeCfg.icon(true, colors.white)}
          </LinearGradient>
          {badges[active] ? <Badge value={badges[active]} style={styles.bubbleBadge} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: BUBBLE_R - BUBBLE_Y,
  },
  systemNavFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.ivory },
  bar: {
    flexDirection: "row",
    height: BAR_H,
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
  },
  fill: { position: "absolute", top: 0, left: 0, height: BAR_H },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 9,
  },
  itemPressed: { opacity: 0.6 },
  iconBox: { width: 44, height: 28, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  label: { fontSize: 11, fontWeight: "600", color: MUTED, letterSpacing: 0.1 },
  labelOn: { color: brand.ink, fontWeight: "800" },
  bubbleWrap: {
    position: "absolute",
    top: 0,
    left: GUTTER,
    width: BUBBLE_R * 2,
    height: BUBBLE_R * 2,
  },
  bubble: {
    width: BUBBLE_R * 2,
    height: BUBBLE_R * 2,
    borderRadius: BUBBLE_R,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: brand.deep,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: 4,
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
  bubbleBadge: { top: -2, right: -4 },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: "800" },
});
