import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSpace } from "../hooks/useBottomSpace";
import { StatusBar } from "expo-status-bar";
import { Cover, badgeFor } from "../components/PropertyCard";
import HeartButton from "../components/HeartButton";
import Button from "../components/Button";
import BottomSheet from "../components/BottomSheet";
import PressableScale from "../components/PressableScale";
import Reveal from "../components/Reveal";
import LoanCalculatorSheet from "../components/LoanCalculatorSheet";
import { smoothLayout } from "../components/compare/CompareTable";
import { ErrorState, LoadingState } from "../components/StateViews";
import { useCompare } from "../context/CompareContext";
import { useSaved } from "../context/SavedContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useIsFocused } from "@react-navigation/native";
import { useApi } from "../hooks/useApi";
import { useEntrance } from "../hooks/useEntrance";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { api } from "../services/api";
import { openExternal } from "../utils/links";
import { propertyWebUrl } from "../config/web";
import { isPresent, listingName } from "../utils/format";
import { brand, colors, fonts, gradients, radius, shadow } from "../theme";
import Text from "../components/AppText";

const { width: W } = Dimensions.get("window");
const GAL_H = Math.round(W * 0.72);
const TABS = [
  { key: "overview", label: "Overview", icon: "home-outline" },
  { key: "details", label: "Details", icon: "list-outline" },
  { key: "amenities", label: "Amenities", icon: "diamond-outline" },
  { key: "location", label: "Location", icon: "location-outline" },
];
const TOP_AMENITIES = 4;
// Every detail block shares one soft fill; icons use the brand violet.
const BLOCK_BG = "#F4EFFF";
const AUTO_SLIDE_MS = 3500;
const AM_GAP = 10;
const AM_TILE_H = 90;
const DOT = 6;
const DOT_GAP = 6;
const MAX_DOTS = 8;

// Icon for an amenity name, matched on keywords; anything unknown gets a tick.
const AMENITY_ICONS = [
  [/pool|swim/i, "water-outline"],
  [/gym|fitness/i, "barbell-outline"],
  [/park(ing)?\b|car|garage/i, "car-outline"],
  [/secur|cctv|guard|gated/i, "shield-checkmark-outline"],
  [/garden|green|landscap|lawn/i, "leaf-outline"],
  [/club|communit|hall|banquet/i, "people-outline"],
  [/lift|elevator/i, "swap-vertical-outline"],
  [/power|backup|generator|electric/i, "flash-outline"],
  [/play|kid|child/i, "happy-outline"],
  [/wi-?fi|internet/i, "wifi-outline"],
  [/spa|yoga|meditat/i, "flower-outline"],
  [/jog|track|walk/i, "walk-outline"],
  [/water|rain/i, "rainy-outline"],
  [/fire/i, "flame-outline"],
  [/sport|court|tennis|badminton|cricket|basket/i, "tennisball-outline"],
];
const amenityIcon = (name) => AMENITY_ICONS.find(([re]) => re.test(name))?.[1] || "checkmark-circle-outline";

// Photo slider. Each photo drifts slower than the swipe and settles from a slight zoom
// (parallax); the active dot slides along, stretching between stops; the counter follows live.
// `scrollY` (the page scroll) adds a pull-down stretch and a slower, parallax scroll-away.
// It also slides on by itself every few seconds (paused while the user swipes or the screen is
// hidden), and a double tap on a photo saves the property with a heart burst.
function Gallery({ images, scrollY, onDoubleTap }) {
  const [i, setI] = useState(0);
  const shown = useRef(0);
  const x = useRef(new Animated.Value(0)).current;
  const reduced = isReducedMotion();
  const listRef = useRef(null);
  const focused = useIsFocused();
  const [dragging, setDragging] = useState(false);
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;

  // Restarts after every page change, so a manual swipe always gets a full pause before the next.
  useEffect(() => {
    if (images.length < 2 || !focused || dragging || reduced) return undefined;
    const t = setTimeout(() => {
      const next = (shown.current + 1) % images.length;
      listRef.current?.scrollToOffset({ offset: next * W, animated: true });
    }, AUTO_SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, images.length, focused, dragging, reduced]);

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      onDoubleTap?.();
      if (!reduced) {
        burst.setValue(0);
        Animated.sequence([
          Animated.spring(burst, { toValue: 1, speed: 18, bounciness: 14, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 2, duration: 260, delay: 220, useNativeDriver: true }),
        ]).start();
      }
    } else lastTap.current = now;
  };

  if (!images.length) return <Cover uri="" style={{ width: W, height: GAL_H }} iconSize={64} />;

  const dots = Math.min(images.length, MAX_DOTS);
  const step = DOT + DOT_GAP;
  // Dot travel, plus a stretch at the midpoint of every swipe.
  const segs = Array.from({ length: Math.max(dots - 1, 1) }, (_, k) => k);
  const stretchIn = segs.flatMap((k) => [k * W, k * W + W / 2]).concat((dots - 1) * W || W);
  const stretchOut = segs.flatMap(() => [1, 2.2]).concat(1);

  const page = scrollY && !reduced
    ? {
        transform: [
          { translateY: scrollY.interpolate({ inputRange: [-GAL_H, 0, GAL_H], outputRange: [-GAL_H / 2, 0, GAL_H * 0.45] }) },
          { scale: scrollY.interpolate({ inputRange: [-GAL_H, 0], outputRange: [2, 1], extrapolate: "clamp" }) },
        ],
      }
    : null;

  return (
    <Animated.View style={page}>
      <Animated.FlatList
        ref={listRef}
        data={images}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={() => setDragging(false)}
        keyExtractor={(u) => u}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
          useNativeDriver: true,
          listener: (e) => {
            const n = Math.round(e.nativeEvent.contentOffset.x / W);
            if (n !== shown.current) {
              shown.current = n;
              setI(n);
            }
          },
        })}
        renderItem={({ item, index }) => {
          const r = [(index - 1) * W, index * W, (index + 1) * W];
          const drift = reduced
            ? null
            : {
                transform: [
                  { translateX: x.interpolate({ inputRange: r, outputRange: [-W * 0.35, 0, W * 0.35], extrapolate: "clamp" }) },
                  { scale: x.interpolate({ inputRange: r, outputRange: [1.12, 1, 1.12], extrapolate: "clamp" }) },
                ],
              };
          return (
            <Pressable onPress={tap} style={styles.page} accessibilityHint="Double tap to save this property">
              <Animated.View style={drift}>
                <Cover uri={item} style={{ width: W, height: GAL_H }} iconSize={64} full />
              </Animated.View>
            </Pressable>
          );
        }}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
      />
      {/* Heart that pops over the photo on a double tap, then floats up and fades. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          {
            opacity: burst.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.25] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, -40] }) },
            ],
          },
        ]}
      >
        <Ionicons name="heart" size={86} color={colors.white} />
      </Animated.View>
      {/* Darkens the top so the round buttons and status bar stay readable on bright photos. */}
      <LinearGradient colors={["rgba(15, 8, 36, 0.45)", "rgba(15, 8, 36, 0)"]} style={styles.galShade} pointerEvents="none" />
      {images.length > 1 ? (
        <>
          <View style={[styles.dots, { width: dots * step - DOT_GAP }]} pointerEvents="none">
            {Array.from({ length: dots }).map((_, k) => (
              <View key={k} style={[styles.dot, { left: k * step }]} />
            ))}
            <Animated.View
              style={[
                styles.dotOn,
                {
                  transform: [
                    { translateX: x.interpolate({ inputRange: [0, (dots - 1) * W || 1], outputRange: [0, (dots - 1) * step], extrapolate: "clamp" }) },
                    { scaleX: reduced ? 1 : x.interpolate({ inputRange: stretchIn, outputRange: stretchOut, extrapolate: "clamp" }) },
                  ],
                },
              ]}
            />
          </View>
          <View style={styles.count} pointerEvents="none">
            <Ionicons name="images-outline" size={12} color={colors.white} />
            <Text style={styles.countText}>{`${i + 1}/${images.length}`}</Text>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

// A detail block that answers touch: it squishes while pressed and springs back, and its icon
// gives a quick wiggle. Purely tactile unless `onPress` is given.
function Tile({ icon, iconSize = 20, iconBox, style, onPress, accessibilityLabel, children }) {
  const press = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const reduced = isReducedMotion();
  const pressIn = () => {
    if (reduced) return;
    Animated.spring(press, { toValue: 1, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (reduced) return;
    Animated.spring(press, { toValue: 0, speed: 14, bounciness: 14, useNativeDriver: true }).start();
    wiggle.setValue(0);
    Animated.timing(wiggle, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  };
  const rotate = wiggle.interpolate({ inputRange: [0, 0.2, 0.45, 0.7, 1], outputRange: ["0deg", "-14deg", "10deg", "-5deg", "0deg"] });
  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[
          style,
          { backgroundColor: BLOCK_BG },
          { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] },
        ]}
      >
        {icon ? (
          <Animated.View style={[iconBox, { transform: [{ rotate }] }]}>
            <Ionicons name={icon} size={iconSize} color={brand.violet} />
          </Animated.View>
        ) : null}
        {children}
      </Animated.View>
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.secHead}>
      <Text style={styles.secTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.secAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AmenityTile({ name, width }) {
  if (!width) return null;
  return (
    <Tile icon={amenityIcon(name)} iconSize={18} iconBox={styles.amIcon} style={[styles.amTile, { width }]} accessibilityLabel={name}>
      <Text style={styles.amText} numberOfLines={2} maxFontSizeMultiplier={1.2}>{name}</Text>
    </Tile>
  );
}

export default function PropertyDetailsScreen({ navigation, route }) {
  const { id, preview } = route.params;
  const insets = useSafeAreaInsets();
  const { tabBar, inset } = useBottomSpace();
  const toast = useToast();
  const cmp = useCompare();
  const saved = useSaved();
  // Developers only open this to preview their own listings: no saving, comparing or enquiring.
  const { user, token, isDeveloper, openLoginPrompt } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.property(id), [id]);
  const p = data?.property || preview;
  const [tab, setTab] = useState("overview");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [rowW, setRowW] = useState(0);
  const [loanOpen, setLoanOpen] = useState(false);
  const [enq, setEnq] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const tick = useRef(new Animated.Value(0)).current;

  // Page scroll drives the gallery parallax and the header that fades in once the photo is gone.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerAt = GAL_H - insets.top - 70;
  const [solid, setSolid] = useState(false);
  const solidRef = useRef(false);
  // Built once: a native-driven handler must not be swapped on every render.
  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: (e) => {
        const next = e.nativeEvent.contentOffset.y > headerAt;
        if (next !== solidRef.current) {
          solidRef.current = next;
          setSolid(next);
        }
      },
    }),
  ).current;

  // Tab underline slides to the active tab.
  const [tabsW, setTabsW] = useState(0);
  const tabX = useRef(new Animated.Value(0)).current;
  const tabIndex = TABS.findIndex((t) => t.key === tab);
  useEffect(() => {
    const to = (tabIndex * tabsW) / TABS.length;
    if (isReducedMotion() || !tabsW) tabX.setValue(to);
    else Animated.spring(tabX, { toValue: to, speed: 18, bounciness: 7, useNativeDriver: true }).start();
  }, [tabIndex, tabsW, tabX]);

  // The newly active tab's icon pops in.
  const tabPop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isReducedMotion()) return;
    tabPop.setValue(0.6);
    Animated.spring(tabPop, { toValue: 1, speed: 16, bounciness: 16, useNativeDriver: true }).start();
  }, [tabIndex, tabPop]);

  // Compare pill bounces whenever it's toggled.
  const inCompareNow = p ? cmp.has(p.id) : false;
  const cmpPop = useRef(new Animated.Value(1)).current;
  const firstCmp = useRef(true);
  useEffect(() => {
    if (firstCmp.current || isReducedMotion()) {
      firstCmp.current = false;
      return;
    }
    cmpPop.setValue(0.75);
    Animated.spring(cmpPop, { toValue: 1, speed: 14, bounciness: 18, useNativeDriver: true }).start();
  }, [inCompareNow, cmpPop]);

  // Bottom bar slides up after the page lands.
  const ctaEnter = useEntrance(280, 70);

  // "Enquire Now" on a property card opens this screen with the enquiry form up (once the
  // screen has slid in). Cards only pass `enquire` for signed-in users.
  const autoEnquire = route.params?.enquire;
  useEffect(() => {
    if (!autoEnquire || !token) return undefined;
    const t = setTimeout(() => setEnq(true), 450);
    return () => clearTimeout(t);
  }, [autoEnquire]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listing links (brochure, tours, map, floor plans) open only when they are https:// web pages.
  const open = (url) => openExternal(url, { onError: (message) => toast.show(message, "error") });
  const share = () =>
    Share.share({
      message: `${p.title}${p.price ? ` · ${p.price}` : ""}${p.city ? ` · ${p.city}` : ""}\n${propertyWebUrl(p.id)}`.trim(),
    }).catch(() => {});

  const contact = () => {
    if (!token) {
      openLoginPrompt({
        reason: "enquiry",
        title: "Sign In to Enquire",
        message: `Please sign in to send an enquiry for ${p.title || "this property"}.`,
      });
      return;
    }
    setEnq(true);
  };

  const send = async () => {
    setSending(true);
    try {
      await api.enquire(p.id, `I'm interested in ${p.title}. Please contact me.`, user?.name);
      setSent(true);
      tick.setValue(0);
      Animated.spring(tick, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      setTimeout(() => {
        setEnq(false);
        setSent(false);
      }, 1500);
    } catch (e) {
      toast.show(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  if (!p)
    return (
      <View style={styles.root}>
        <View style={{ paddingTop: insets.top + 60 }}>
          {loading ? (
            <View style={{ padding: 20 }}>
              <LoadingState rows={3} />
            </View>
          ) : (
            <ErrorState title="Unable to load property" error={error} onRetry={reload} />
          )}
        </View>
      </View>
    );

  const name = listingName(p);
  // Our own website's page for this listing (empty until EXPO_PUBLIC_WEB_URL is set).
  const webUrl = propertyWebUrl(p.id);
  const where = [p.locality, p.city].filter(Boolean).join(", ");
  // The opening card knows sale / rent from its search; otherwise fall back to the listing badge.
  const tag = route.params?.tag || badgeFor(p);
  const isRent = tag === "For Rent";
  const price = p.priceMin ? `${p.priceMin} – ${p.price}` : p.price;
  const inCompare = cmp.has(p.id);
  const allAmenities = [...new Set([...(p.amenities || []), ...(p.facilities || []), ...(p.security || [])])];
  const about = p.description || p.longDescription;
  const stats = [
    p.bhk && { icon: "bed-outline", text: `${p.bhk} Beds` },
    p.bathrooms && { icon: "water-outline", text: `${p.bathrooms} Baths` },
    p.area && { icon: "resize-outline", text: p.area },
  ].filter(Boolean);
  const facts = [
    ["BHK", p.bhk && `${p.bhk} BHK`],
    ["Area", p.area],
    ["Type", p.propertyType],
    ["Possession", p.possessionStatus],
    ["Floor", [p.floor, p.totalFloors && `of ${p.totalFloors}`].filter(Boolean).join(" ")],
    ["Parking", p.parkings],
    ["Facing", p.facing],
    ["Furnishing", p.furnishing],
    ["Bathrooms", p.bathrooms],
    ["Balconies", p.balconies],
    ["Wing", p.wing],
    ["Age", p.ageOfProperty],
    ["Building grade", p.buildingGrade],
    ["Units available", p.unitsAvailable],
    ["RERA", p.reraNumber],
  ].filter(([, v]) => isPresent(v));
  // Four amenity tiles per row, sized from the row's measured width.
  const tileW = rowW ? Math.floor((rowW - AM_GAP * 3) / 4) : 0;
  const measureRow = (e) => setRowW(e.nativeEvent.layout.width);
  const switchTab = (k) => {
    if (k === tab) return;
    smoothLayout();
    setTab(k);
  };

  return (
    <View style={styles.root}>
      <StatusBar style={solid ? "dark" : "light"} />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (isDeveloper ? 24 : 96) + tabBar + Math.max(inset, 10) }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Gallery
          images={p.galleryImages?.length ? p.galleryImages : p.image ? [p.image] : []}
          scrollY={scrollY}
          onDoubleTap={() => { if (!saved.isSaved(p.id)) saved.toggle(p.id); }}
        />

        <View style={styles.sheet}>
          {p.approvalStatus && p.approvalStatus !== "approved" ? (
            <View style={styles.pending}>
              <Ionicons name="time-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.pendingText}>
                {p.approvalStatus === "pending" ? "Awaiting admin approval – only you can see this." : "This listing was not approved."}
              </Text>
            </View>
          ) : null}

          <View>
            <Reveal delay={60} distance={16}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{name}</Text>
              {tag ? (
                <View style={[styles.tag, isRent && styles.tagRent]}>
                  {isRent ? null : <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                  <Text style={[styles.tagText, isRent && { color: brand.deep }]}>{tag}</Text>
                </View>
              ) : null}
            </View>
            {where ? (
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={15} color={brand.inkSoft} />
                <Text style={styles.loc} numberOfLines={1}>{where}</Text>
              </View>
            ) : null}
            <View style={styles.priceRow}>
              {price ? (
                <Text style={styles.price} numberOfLines={1}>
                  {price}
                  {isRent ? <Text style={styles.perMonth}> /month</Text> : null}
                </Text>
              ) : (
                <Text style={styles.poa}>Price on request</Text>
              )}
            </View>
            {p.rating?.count ? (
              <View style={styles.rateRow}>
                <Ionicons name="star" size={13} color={brand.goldBright} />
                <Text style={styles.rateText}>{`${p.rating.average.toFixed(1)} · ${p.rating.count} rating${p.rating.count === 1 ? "" : "s"}`}</Text>
              </View>
            ) : null}
            </Reveal>

            {/* Tabs */}
            <Reveal delay={140} distance={12} style={styles.tabs} accessibilityRole="tablist" onLayout={(e) => setTabsW(e.nativeEvent.layout.width)}>
              {TABS.map((t) => {
                const on = t.key === tab;
                return (
                  <Pressable key={t.key} onPress={() => switchTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                    <Animated.View style={on ? { transform: [{ scale: tabPop }, { translateY: tabPop.interpolate({ inputRange: [0.6, 1], outputRange: [3, 0] }) }] } : null}>
                      <Ionicons name={t.icon} size={18} color={on ? brand.violet : brand.inkSoft} />
                    </Animated.View>
                    <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{t.label}</Text>
                  </Pressable>
                );
              })}
              {tabsW ? (
                <Animated.View pointerEvents="none" style={[styles.tabInk, { width: tabsW / TABS.length, transform: [{ translateX: tabX }] }]}>
                  <View style={styles.tabInkBar} />
                </Animated.View>
              ) : null}
            </Reveal>

            {/* Each tab's content fades up when it opens. */}
            <Reveal key={tab} distance={14}>

            {tab === "overview" ? (
              <View>
                {about ? (
                  <>
                    <SectionTitle title="Overview" />
                    <Text style={styles.body} numberOfLines={aboutOpen ? undefined : 4}>{about}</Text>
                    {about.length > 180 ? (
                      <Pressable onPress={() => { smoothLayout(); setAboutOpen((v) => !v); }} hitSlop={6}>
                        <Text style={styles.more}>{aboutOpen ? "Read less" : "Read more"}</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}

                {stats.length ? (
                  <View style={styles.stats}>
                    {stats.map((s) => (
                      <View key={s.icon} style={{ flex: 1 }}>
                        <Tile icon={s.icon} style={styles.stat} accessibilityLabel={s.text}>
                          <Text style={styles.statText} numberOfLines={1}>{s.text}</Text>
                        </Tile>
                      </View>
                    ))}
                  </View>
                ) : null}

                {p.priceValue ? (
                  <PressableScale onPress={() => setLoanOpen(true)} to={0.98} style={styles.emi} accessibilityRole="button" accessibilityLabel="Open EMI calculator">
                    <View style={styles.emiIcon}>
                      <Ionicons name="calculator-outline" size={20} color={brand.violet} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emiLabel}>{p.emi ? "EMI starts from" : "Plan your home loan"}</Text>
                      <Text style={styles.emiValue}>{p.emi ? `${p.emi}/month` : "Calculate your EMI"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={brand.violet} />
                  </PressableScale>
                ) : null}

                {allAmenities.length ? (
                  <>
                    <SectionTitle
                      title="Top Amenities"
                      action={allAmenities.length > TOP_AMENITIES ? "View All" : null}
                      onAction={() => switchTab("amenities")}
                    />
                    <View style={styles.amGrid} onLayout={measureRow}>
                      {allAmenities.slice(0, TOP_AMENITIES).map((a) => <AmenityTile key={a} name={a} width={tileW} />)}
                    </View>
                  </>
                ) : null}

                {p.developerName ? (
                  <>
                    <SectionTitle title="Developer" />
                    <View style={styles.dev}>
                      {p.developerAvatar ? (
                        <Image source={{ uri: p.developerAvatar }} style={styles.devImg} />
                      ) : (
                        <View style={[styles.devImg, styles.devPh]}>
                          <Ionicons name="business-outline" size={22} color={brand.violet} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.devName}>{p.developerName}</Text>
                        {p.reraNumber ? <Text style={styles.rera}>RERA · {p.reraNumber}</Text> : null}
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            ) : tab === "details" ? (
              <View>
                <SectionTitle title="Property Details" />
                {facts.length ? (
                  <View style={styles.grid}>
                    {facts.map(([k, v]) => (
                      <View key={k} style={styles.factWrap}>
                        <Tile style={styles.fact} accessibilityLabel={`${k}: ${v}`}>
                          <Text style={styles.fk}>{k}</Text>
                          <Text style={styles.fv} numberOfLines={2}>{v}</Text>
                        </Tile>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.none}>No further details are listed.</Text>
                )}
                {p.longDescription && p.longDescription !== about ? (
                  <>
                    <SectionTitle title="More about this property" />
                    <Text style={styles.body}>{p.longDescription}</Text>
                  </>
                ) : null}
                {p.floorPlans?.length ? (
                  <>
                    <SectionTitle title="Floor plans" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {p.floorPlans.map((u) => (
                        <Pressable key={u} onPress={() => open(u)}>
                          <Cover uri={u} style={styles.plan} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                {p.virtualTours?.length || p.brochure || webUrl ? (
                  <>
                    <SectionTitle title="Explore more" />
                    <View style={{ gap: 10 }}>
                      {p.virtualTours.map((u, i) => (
                        <Button key={u} variant="ghost" small icon="play-circle-outline" title={p.virtualTours.length > 1 ? `Virtual tour ${i + 1}` : "Virtual tour"} onPress={() => open(u)} />
                      ))}
                      {p.brochure ? <Button variant="ghost" small icon="download-outline" title="Download brochure" onPress={() => open(p.brochure)} /> : null}
                      {webUrl ? <Button variant="ghost" small icon="globe-outline" title="View on website" onPress={() => open(webUrl)} /> : null}
                    </View>
                  </>
                ) : null}
              </View>
            ) : tab === "amenities" ? (
              <View>
                <SectionTitle title={`Amenities${allAmenities.length ? ` (${allAmenities.length})` : ""}`} />
                {allAmenities.length ? (
                  <View style={styles.amGrid} onLayout={measureRow}>
                    {allAmenities.map((a) => <AmenityTile key={a} name={a} width={tileW} />)}
                  </View>
                ) : (
                  <Text style={styles.none}>No amenities are listed for this property.</Text>
                )}
              </View>
            ) : (
              <View>
                <SectionTitle title="Location" />
                <View style={styles.locCard}>
                  <View style={styles.emiIcon}>
                    <Ionicons name="location" size={20} color={brand.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {p.address ? <Text style={styles.body}>{p.address}</Text> : null}
                    <Text style={p.address ? styles.rera : styles.body}>
                      {[p.locality, p.city, p.pincode].filter(Boolean).join(", ") || "Location not listed"}
                    </Text>
                  </View>
                </View>
                {p.mapLink || where ? (
                  <Button
                    variant="ghost"
                    small
                    icon="navigate-outline"
                    title="Open in Maps"
                    onPress={() => open(p.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.address, where].filter(Boolean).join(", "))}`)}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
              </View>
            )}
            </Reveal>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Solid header with the title, faded in once the photo has scrolled away. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.solidHead,
          { height: insets.top + 56, paddingTop: insets.top, opacity: scrollY.interpolate({ inputRange: [headerAt - 50, headerAt], outputRange: [0, 1], extrapolate: "clamp" }) },
        ]}
      >
        <Text style={styles.solidTitle} numberOfLines={1}>{name}</Text>
      </Animated.View>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <PressableScale to={0.88} onPress={() => navigation.goBack()} style={styles.round} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color={brand.ink} />
        </PressableScale>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {isDeveloper ? null : (
            <View style={styles.round}>
              <HeartButton id={p.id} size={19} floating={false} />
            </View>
          )}
          <PressableScale to={0.88} onPress={share} style={styles.round} accessibilityRole="button" accessibilityLabel="Share">
            <Ionicons name="share-social-outline" size={19} color={brand.ink} />
          </PressableScale>
        </View>
      </View>

      {/* Sits above whatever the bottom bar reports (the compare card on inner screens), else the system bar. */}
      {isDeveloper ? null : (
      <Animated.View style={[styles.cta, ctaEnter, { bottom: tabBar, paddingBottom: tabBar ? 12 : Math.max(inset, 10) + 4 }]}>
        <PressableScale
          onPress={() => cmp.toggle(p.id)}
          to={0.95}
          style={[styles.cmpBtn, inCompare && styles.cmpBtnOn]}
          accessibilityRole="button"
          accessibilityLabel={inCompare ? "Remove from compare" : "Add to compare"}
        >
          <Animated.View style={{ transform: [{ scale: cmpPop }] }}>
            <Ionicons name={inCompare ? "checkmark-circle" : "swap-horizontal"} size={18} color={brand.violet} />
          </Animated.View>
          <Text style={styles.cmpBtnText}>{inCompare ? "Added" : "Compare"}</Text>
        </PressableScale>
        <PressableScale onPress={contact} to={0.96} style={styles.contactBtn} accessibilityRole="button" accessibilityLabel="Send enquiry">
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
          <Text style={styles.contactText}>Send Enquiry</Text>
        </PressableScale>
      </Animated.View>
      )}

      <LoanCalculatorSheet visible={loanOpen} onClose={() => setLoanOpen(false)} initialAmount={p.priceValue} />

      <BottomSheet visible={enq} onClose={() => !sending && setEnq(false)} title="Send an enquiry">
        {sent ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <Animated.View style={[styles.okCircle, { transform: [{ scale: tick }] }]}>
              <Ionicons name="checkmark" size={36} color={colors.white} />
            </Animated.View>
            <Text style={styles.okTitle}>Enquiry sent</Text>
            <Text style={styles.okSub}>We will contact you on +91 {user?.phone} shortly.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.enqFor} numberOfLines={1}>{p.title}</Text>
            <Text style={styles.enqNote}>We will share your mobile number (+91 {user?.phone}) with the owner / project team.</Text>
            <Button title="Send enquiry" onPress={send} loading={sending} style={{ marginTop: 14 }} />
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  // Full-width panel over the bottom of the photo; content sits straight on it (no inner card).
  sheet: { marginTop: -22, paddingHorizontal: 16, paddingTop: 18, backgroundColor: brand.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow.glass },
  page: { width: W, height: GAL_H, overflow: "hidden" },
  burst: { position: "absolute", top: GAL_H / 2 - 43, alignSelf: "center", ...shadow.float },
  galShade: { position: "absolute", top: 0, left: 0, right: 0, height: 110 },
  dots: { position: "absolute", bottom: 34, alignSelf: "center", height: DOT },
  dot: { position: "absolute", top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: "rgba(255,255,255,0.5)" },
  dotOn: { position: "absolute", top: 0, left: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.white },
  solidHead: { position: "absolute", top: 0, left: 0, right: 0, justifyContent: "center", paddingHorizontal: 120, backgroundColor: colors.white, ...shadow.card },
  solidTitle: { fontSize: 15, fontWeight: "800", color: brand.ink, textAlign: "center" },
  count: { position: "absolute", right: 16, bottom: 32, flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "rgba(15, 8, 36, 0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  countText: { color: colors.white, fontSize: 11.5, fontWeight: "700" },
  pending: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: brand.lavender, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  pendingText: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: "600" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: "800", color: brand.ink },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: "hidden", marginTop: 2 },
  tagRent: { backgroundColor: brand.lavender },
  tagText: { fontSize: 11.5, fontWeight: "800", color: colors.white },
  locRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  loc: { flex: 1, color: brand.inkSoft, fontSize: 13.5 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  price: { flex: 1, fontSize: 24, fontWeight: "800", color: brand.violet },
  perMonth: { fontSize: 14, fontWeight: "700", color: brand.inkSoft },
  poa: { flex: 1, fontSize: 17, fontWeight: "700", color: brand.inkSoft },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  rateText: { fontSize: 12.5, fontWeight: "700", color: brand.ink },
  tabs: { flexDirection: "row", marginTop: 16, marginHorizontal: -16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  tabText: { fontSize: 12, fontWeight: "600", color: brand.inkSoft },
  tabTextOn: { color: brand.violet, fontWeight: "800" },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingTop: 10, paddingBottom: 10 },
  tabInk: { position: "absolute", left: 0, bottom: 0, height: 3, paddingHorizontal: 14 },
  tabInkBar: { flex: 1, borderRadius: 2, backgroundColor: brand.violet },
  secHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 8 },
  secTitle: { fontSize: 16, fontWeight: "800", color: brand.ink },
  secAction: { fontSize: 13, fontWeight: "800", color: brand.violet },
  body: { fontSize: 13.5, lineHeight: 20, color: colors.text },
  more: { fontSize: 13, fontWeight: "800", color: brand.violet, marginTop: 4 },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  stat: { alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 14 },
  statText: { fontSize: 12.5, fontWeight: "700", color: brand.ink },
  emi: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: BLOCK_BG },
  emiIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  emiLabel: { fontSize: 11.5, fontWeight: "600", color: brand.inkSoft },
  emiValue: { fontSize: 15, fontWeight: "800", color: brand.ink, marginTop: 1 },
  amGrid: { flexDirection: "row", flexWrap: "wrap", gap: AM_GAP },
  // Fixed height (room for a two-line name) so every amenity tile is the same size.
  amTile: { height: AM_TILE_H, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, borderRadius: 14 },
  amIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255, 255, 255, 0.75)", alignItems: "center", justifyContent: "center" },
  amText: { fontSize: 11, lineHeight: 14, fontWeight: "700", color: brand.ink, textAlign: "center" },
  dev: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: BLOCK_BG },
  devImg: { width: 46, height: 46, borderRadius: 14 },
  devPh: { alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  devName: { fontSize: 15, fontWeight: "800", color: brand.ink },
  rera: { fontSize: 12, color: brand.inkSoft, marginTop: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  factWrap: { width: "48%", flexGrow: 1 },
  fact: { borderRadius: 14, padding: 12 },
  fk: { fontSize: 10.5, fontWeight: "800", color: brand.inkSoft, letterSpacing: 0.8, textTransform: "uppercase" },
  fv: { fontSize: 14, fontWeight: "700", color: brand.ink, marginTop: 4 },
  none: { fontSize: 13, color: brand.inkSoft },
  plan: { width: 220, height: 160, borderRadius: radius.md },
  locCard: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, backgroundColor: BLOCK_BG },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow.glassFloat },
  cmpBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 50, borderRadius: 14, borderWidth: 1.4, borderColor: brand.lavenderMid, backgroundColor: colors.white },
  cmpBtnOn: { backgroundColor: brand.lavender, borderColor: brand.violet },
  cmpBtnText: { fontSize: 15, fontWeight: "800", color: brand.ink },
  contactBtn: { flex: 1.8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14, overflow: "hidden" },
  contactText: { fontSize: 15, fontWeight: "800", color: colors.white },
  enqFor: { fontWeight: "800", color: colors.ink, marginBottom: 12, fontSize: 15 },
  enqNote: { fontSize: 12, color: colors.muted, marginTop: 10 },
  okCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  okTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, marginTop: 16 },
  okSub: { color: colors.muted, marginTop: 6, textAlign: "center" },
});
