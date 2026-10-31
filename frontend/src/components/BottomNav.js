import React, { useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightCallbackContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { G, Path } from "react-native-svg";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { brand, colors, gradients } from "../theme";
import { useAuth } from "../context/AuthContext";
import { isReducedMotion } from "../hooks/useReducedMotion";
import Text from "./AppText";

// Bar geometry. The active tab's icon sits in a floating bubble that rests in a notch cut
// into the bar's top edge; both slide to the tapped tab.
const BAR_H = 60;
const BAR_RADIUS = 20;
const GUTTER = 14;
const BAR_INSET = 14; // horizontal padding inside the bar, keeps the end notches off the corners
const BUBBLE_R = 23;
const BUBBLE_Y = 2; // bubble centre, measured down from the bar's top edge
const NOTCH_R = 30; // half-width of the bowl
const NOTCH_SHOULDER = 10; // smoothing where the bowl meets the flat edge
const NOTCH_DEPTH = 31;
const SHADOW_BLEED = 16; // room around the bar for its soft shadow

// Stacked translucent strokes fake a soft drop shadow (SVG shapes can't use native shadows).
const SHADOW_LAYERS = [
  { width: 28, opacity: 0.025 },
  { width: 20, opacity: 0.035 },
  { width: 13, opacity: 0.045 },
  { width: 7, opacity: 0.06 },
  { width: 3, opacity: 0.08 },
];

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

// Outline of the whole bar (rounded rect of `width`) with the notch centred at `cx`. A notch
// close to an end shrinks that top corner instead of overlapping it.
function barPath(width, cx) {
  const R = BAR_RADIUS;
  const l = cx - NOTCH_R - NOTCH_SHOULDER;
  const r = cx + NOTCH_R + NOTCH_SHOULDER;
  const tl = Math.max(0, Math.min(R, l));
  const tr = Math.max(0, Math.min(R, width - r));
  return [
    `M${tl} 0 H${Math.max(l, tl)}`,
    `C${cx - NOTCH_R} 0 ${cx - NOTCH_R} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH}`,
    `C${cx + NOTCH_R} ${NOTCH_DEPTH} ${cx + NOTCH_R} 0 ${Math.min(r, width - tr)} 0`,
    `H${width - tr} A${tr} ${tr} 0 0 1 ${width} ${tr}`,
    `V${BAR_H - R} A${R} ${R} 0 0 1 ${width - R} ${BAR_H}`,
    `H${R} A${R} ${R} 0 0 1 0 ${BAR_H - R}`,
    `V${tl} A${tl} ${tl} 0 0 1 ${tl} 0 Z`,
  ].join(" ");
}

// Shadow + fill, redrawn as the notch moves.
function BarShape({ width, x }) {
  const [cx, setCx] = useState(x.__getValue());
  useEffect(() => {
    let frame = 0;
    const id = x.addListener(({ value }) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCx(value));
    });
    return () => {
      x.removeListener(id);
      cancelAnimationFrame(frame);
    };
  }, [x]);
  const d = barPath(width, cx);
  return (
    <Svg
      pointerEvents="none"
      width={width + SHADOW_BLEED * 2}
      height={BAR_H + SHADOW_BLEED * 2}
      style={styles.shape}
    >
      <G transform={`translate(${SHADOW_BLEED}, ${SHADOW_BLEED + 3})`}>
        {SHADOW_LAYERS.map((s) => (
          <Path key={s.width} d={d} fill="none" stroke={brand.deep} strokeOpacity={s.opacity} strokeWidth={s.width} strokeLinejoin="round" />
        ))}
      </G>
      <G transform={`translate(${SHADOW_BLEED}, ${SHADOW_BLEED})`}>
        <Path d={d} fill={colors.white} stroke="rgba(124, 44, 245, 0.14)" strokeWidth={1} />
      </G>
    </Svg>
  );
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
    const to = BAR_INSET + ((state.index + 0.5) * (width - BAR_INSET * 2)) / count;
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
        {width ? <BarShape width={width} x={x} /> : null}

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
    paddingHorizontal: BAR_INSET,
  },
  shape: { position: "absolute", top: -SHADOW_BLEED, left: -SHADOW_BLEED },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
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
