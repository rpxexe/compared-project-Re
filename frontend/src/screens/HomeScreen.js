import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, FlatList, Image, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Logo from "../components/Logo";
import GlassView from "../components/GlassView";
import HeartButton from "../components/HeartButton";
import MiniBarChart from "../components/MiniBarChart";
import MiniLineChart from "../components/MiniLineChart";
import LoanCalculatorSheet from "../components/LoanCalculatorSheet";
import PressableScale from "../components/PressableScale";
import RollingPlaceholder from "../components/RollingPlaceholder";
import { Cover } from "../components/PropertyCard";
import { ErrorState, LoadingState } from "../components/StateViews";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { useCity } from "../hooks/useCity";
import { useEntrance } from "../hooks/useEntrance";
import { api } from "../services/api";
import { formatInr } from "../utils/format";
import {
  clearSearchHistory,
  getSearchHistory,
  subscribeSearchHistory,
} from "../services/historyService";
import BottomSheet from "../components/BottomSheet";
import { brand, colors, fonts, gradients, radius, surfaces } from "../theme";
import Text from "../components/AppText";

const HERO_IMAGE = require("../../assets/onboarding_residence.jpg");
const safe = (p) => p.catch(() => null);

const QUICK_ACTIONS = [
  { key: "resume", label: "Resume Search", icon: "play-forward", bg: "#FFE4EE", fg: "#E0457B" },
  { key: "wishlist", label: "My Wishlist", icon: "heart", bg: "#FFE3E6", fg: "#E5484D" },
  { key: "recommend", label: "Top Picks", icon: "sparkles", bg: "#E3EEFF", fg: "#3B6FE0" },
  { key: "recent", label: "Recent Searches", icon: "time", bg: "#EEE6FF", fg: brand.violet },
];

// Tabs above the search bar; each opens the search form with that context preselected.
const SEARCH_TABS = [
  { context: "buy_residential", label: "Buy", icon: "key-outline" },
  { context: "rent_residential", label: "Rent", icon: "home-outline" },
  { context: "new_projects", label: "Projects", icon: "business-outline" },
];

// Short axis labels; the chart readout shows the full stage name.
const STAGE_SHORT = { "Ready To Move": "Ready", "Under Construction": "U/C", "New Launch": "New" };

function stageBadge(p) {
  const s = `${p.possessionStatus || ""} ${p.propertyGroup || ""}`;
  if (/upcoming/i.test(s)) return { text: "Upcoming", bg: "#FFF1D6", fg: "#9A6100" };
  if (/new\s*launch|pre[-\s]?launch/i.test(s)) return { text: "New Launch", bg: "#FFE9D6", fg: "#B4530A" };
  if (/under\s*construction/i.test(s)) return { text: "Under Construction", bg: "#E8F1FF", fg: "#2F5FC4" };
  return { text: "Launching Soon", bg: "#FFF1D6", fg: "#9A6100" };
}

const bhkLine = (p) =>
  [p.bhk ? `${p.bhk} BHK` : "", p.propertyType ? p.propertyType.replace(/^Flats\/Apartments$/i, "Apartments") : ""]
    .filter(Boolean)
    .join(" ");

const placeLine = (p) => [p.locality, p.city].filter(Boolean).join(", ");

function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={onAction} hitSlop={10} style={styles.viewAll} accessibilityRole="button">
          <Text style={styles.viewAllText}>{action}</Text>
          <Ionicons name="arrow-forward" size={14} color={brand.violet} />
        </PressableScale>
      ) : null}
    </View>
  );
}

// Listing titles read "3 BHK Apartments in DGS Sheetal Sky Tower, Oshiwara, ..."; the card heads
// with the project name when there is one (not when the "in ..." part is just the locality).
function cardName(p) {
  const m = String(p.title || "").match(/\bin\s+([^,]+)/i);
  const name = m && m[1].trim();
  return name && name.toLowerCase() !== String(p.locality || "").toLowerCase() && name.toLowerCase() !== String(p.city || "").toLowerCase()
    ? name
    : p.title;
}

// Photo inset in a rounded card, name with a RERA tick, price + place, then small stats and a
// "View" pill - the layout of a profile card, filled with listing facts.
const FeaturedCard = React.memo(function FeaturedCard({ p, width, onOpen }) {
  const name = cardName(p);
  const place = placeLine(p);
  return (
    <PressableScale
      to={0.98}
      onPress={() => onOpen(p)}
      style={[styles.fCard, { width }]}
      accessibilityRole="button"
      accessibilityLabel={[name, p.reraNumber && "RERA registered", p.price, place, p.bhk && `${p.bhk} BHK`, p.area].filter(Boolean).join(", ")}
    >
      <View style={[styles.fImageWrap, { height: Math.round((width - 16) * 0.8) }]}>
        <Cover uri={p.image} style={StyleSheet.absoluteFill} iconSize={32} />
        <HeartButton id={p.id} size={16} style={styles.fHeart} />
      </View>
      <View style={styles.fBody}>
        <View style={styles.fNameRow}>
          <Text style={styles.fTitle} numberOfLines={1}>
            {name}
          </Text>
          {p.reraNumber ? <Ionicons name="checkmark-circle" size={16} color={colors.success} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        </View>
        <Text style={styles.fDesc} numberOfLines={2}>
          {p.price ? <Text style={styles.fPrice}>{p.price}</Text> : null}
          {p.price && place ? "  ·  " : ""}
          {place}
        </Text>
        <View style={styles.fFoot}>
          {p.bhk ? <Stat icon="bed-outline" text={`${p.bhk} BHK`} /> : null}
          {p.area ? <Stat icon="resize-outline" text={p.area} /> : null}
          <View style={{ flex: 1 }} />
          <View style={styles.fPill}>
            <Text style={styles.fPillText}>View</Text>
            <Ionicons name="arrow-forward" size={13} color={brand.ink} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

function Stat({ icon, text }) {
  return (
    <View style={styles.fStat}>
      <Ionicons name={icon} size={13} color={brand.inkSoft} />
      <Text style={styles.fStatText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const UpcomingCard = React.memo(function UpcomingCard({ p, onOpen }) {
  const badge = stageBadge(p);
  return (
    <PressableScale to={0.98} onPress={() => onOpen(p)} style={styles.uCard} accessibilityRole="button" accessibilityLabel={`${p.title}, ${badge.text}, ${placeLine(p)}`}>
      <Cover uri={p.image} style={styles.uImage} iconSize={20} />
      <View style={styles.uBody}>
        <View style={[styles.uBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.uBadgeText, { color: badge.fg }]} numberOfLines={1}>
            {badge.text}
          </Text>
        </View>
        <Text style={styles.uTitle} numberOfLines={1}>
          {p.title}
        </Text>
        <Text style={styles.uMeta} numberOfLines={1}>
          {placeLine(p)}
        </Text>
        {p.bhk ? <Text style={styles.uMeta}>{`${p.bhk} BHK`}</Text> : null}
      </View>
    </PressableScale>
  );
});

export default function HomeScreen({ navigation }) {
  const { token, openLoginPrompt } = useAuth();
  const { width: W } = useWindowDimensions();
  const [city, setCity, { detectingLocation }] = useCity();
  const [selectedLocality, setSelectedLocality] = useState("");
  const [searchHistory, setSearchHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loanSheet, setLoanSheet] = useState(null); // null | "emi" | "eligibility"
  const [recentOpen, setRecentOpen] = useState(false);
  const [tabsWidth, setTabsWidth] = useState(0);
  const focused = useIsFocused(); // pauses the rolling search hint while Home is hidden

  const heroAnim = useEntrance(0, 14);
  const cardW = Math.min(Math.round((W - 40) / 1.55), 250);

  useEffect(() => {
    getSearchHistory().then(setSearchHistory).catch(() => {});
    return subscribeSearchHistory(setSearchHistory);
  }, []);

  // Real unread count (signed-in users only); refreshed whenever Home regains focus.
  const loadUnread = useCallback(() => {
    if (!token) return setUnread(0);
    api.notifications().then((r) => setUnread(r?.unreadCount || 0)).catch(() => {});
  }, [token]);
  useEffect(() => {
    loadUnread();
    return navigation.addListener("focus", loadUnread);
  }, [navigation, loadUnread]);

  const { data, loading, error, reload, refresh } = useApi(async () => {
    const base = {};
    if (city) base.city = city;
    if (selectedLocality) base.locality = selectedLocality;
    const [featured, recent, launch, upcoming, insights] = await Promise.all([
      safe(api.properties({ ...base, featured: true, limit: 8 })),
      api.properties({ ...base, limit: 8 }),
      safe(api.properties({ ...base, section: "new-launch", limit: 6 })),
      safe(api.properties({ ...base, section: "upcoming", limit: 6 })),
      safe(api.insights(city)),
    ]);
    return { featured, recent, launch, upcoming, insights };
  }, [city, selectedLocality]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadUnread()]);
    setRefreshing(false);
  };

  const openProperty = useCallback((p) => navigation.navigate("PropertyDetails", { id: p.id, preview: p }), [navigation]);

  // No property in the data is flagged "featured" yet, so fall back to the latest listings and
  // title the rail honestly rather than calling them featured.
  const featuredItems = data?.featured?.items?.length ? data.featured.items : data?.recent?.items || [];
  const featuredTitle = data?.featured?.items?.length ? "Featured Properties" : city ? `Latest in ${city}` : "Latest Properties";

  const upcomingItems = useMemo(() => {
    const seen = new Set();
    return [...(data?.upcoming?.items || []), ...(data?.launch?.items || [])].filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 8);
  }, [data]);

  const insights = data?.insights;
  const priceData = (insights?.priceByBhk || []).map((b) => ({ label: `${b.bhk} BHK`, value: b.medianPrice }));
  const stageData = (insights?.listingsByStage || []).map((s) => ({ label: s.stage, short: STAGE_SHORT[s.stage] || s.stage, value: s.listings }));

  const runSearch = (params) => {
    navigation.navigate("Search", { city: city || "", locality: selectedLocality || "", ...params });
  };

  // The search bar opens the full search form (context tabs, location, filters).
  const openSearch = (context) =>
    navigation.navigate("SearchFilters", { city: city || "", locality: selectedLocality || "", ...(context ? { context } : {}) });

  const rerunSearch = (item) => {
    if (item.city && item.city !== city) setCity(item.city);
    navigation.navigate("Search", {
      city: item.city || city || "",
      locality: item.locality || "",
      search: item.query || "",
      propertyType: item.propertyType || "",
      bhk: item.bhk || "",
    });
  };

  const onQuickAction = (key) => {
    if (key === "resume") {
      if (searchHistory[0]) rerunSearch(searchHistory[0]);
      else openSearch();
    } else if (key === "wishlist") {
      if (token) navigation.navigate("Saved");
      else openLoginPrompt({ reason: "general", title: "Sign In to See Your Wishlist", message: "Sign in to save properties and find them here on any device." });
    } else if (key === "recommend") {
      // Top-rated listings in the user's city, narrowed by their most recent search if any.
      const last = searchHistory[0];
      runSearch({ sort: "rating", propertyType: last?.propertyType || "", bhk: last?.bhk || "" });
    } else if (key === "recent") {
      setRecentOpen(true);
    }
  };

  const cityLabel = detectingLocation ? "Locating…" : selectedLocality || city || "All India";

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.violet} colors={[brand.violet]} />}
    >
      {/* Architecture bleeding in from the top-right, faded into the canvas. */}
      <View style={[styles.heroImageWrap, { width: W * 0.58 }]} pointerEvents="none">
        <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" fadeDuration={0} />
        <View style={[StyleSheet.absoluteFill, styles.heroWash]} />
        <LinearGradient
          colors={[colors.ivory, "rgba(251,249,255,0.5)", "rgba(251,249,255,0)"]}
          locations={[0, 0.45, 0.85]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={["rgba(251,249,255,0)", colors.ivory]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
      </View>

      <View style={styles.header}>
        <Logo tone="dark" size={30} wordSize={17} />
        <View style={styles.headerRight}>
          <PressableScale onPress={() => navigation.navigate("Location")} accessibilityRole="button" accessibilityLabel={`Location: ${cityLabel}. Change location`}>
            <GlassView level="regular" blur borderRadius={radius.pill} style={styles.cityPill}>
              <Ionicons name="location" size={14} color={brand.violet} />
              <Text style={styles.cityText} numberOfLines={1}>
                {cityLabel}
              </Text>
              <Ionicons name="chevron-down" size={13} color={brand.ink} />
            </GlassView>
          </PressableScale>
          <PressableScale
            onPress={() => navigation.navigate("Notification")}
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <GlassView level="regular" blur borderRadius={21} style={styles.bell}>
              <Ionicons name="notifications" size={19} color={brand.ink} />
              {unread > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              ) : null}
            </GlassView>
          </PressableScale>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.h1} accessibilityRole="header">
          Find Your{"\n"}Dream <Text style={{ color: brand.violet }}>Property</Text>
        </Text>
        <Text style={styles.heroSub}>Compare projects, prices and{"\n"}amenities — all in one place.</Text>
      </View>

      {/* Folder-style tabs sitting on the search bar's top-left edge. */}
      <View style={styles.searchBlock}>
        <View style={styles.searchTabs} accessibilityRole="tablist" onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}>
          {SEARCH_TABS.map((t, i) => (
            <React.Fragment key={t.context}>
              {i > 0 ? <View style={styles.searchTabDivider} /> : null}
              <PressableScale
                to={0.95}
                onPress={() => openSearch(t.context)}
                style={styles.searchTab}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityHint={`Opens search with ${t.label} selected`}
              >
                <Ionicons name={t.icon} size={14} color={brand.violet} />
                <Text style={styles.searchTabText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{t.label}</Text>
              </PressableScale>
            </React.Fragment>
          ))}
        </View>

        <PressableScale onPress={() => openSearch()} to={0.98} accessibilityRole="search" accessibilityLabel="Search properties" accessibilityHint="Opens search with filters">
          <GlassView level="strong" borderRadius={radius.lg} style={[styles.search, styles.searchAttached]}>
            {/* Covers the bar's top border under the tabs so the two read as one shape. */}
            {tabsWidth ? <View pointerEvents="none" style={[styles.searchSeam, { width: tabsWidth }]} /> : null}
            <Ionicons name="search" size={19} color={brand.inkSoft} style={{ marginLeft: 4 }} />
            <RollingPlaceholder active={focused} style={styles.searchInput} />
          </GlassView>
        </PressableScale>
      </View>

      <Animated.View style={heroAnim}>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <PressableScale
              key={a.key}
              to={0.95}
              onPress={() => onQuickAction(a.key)}
              style={[styles.quickTile, { width: (W - 50) / 2 }]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={18} color={a.fg} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {a.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </Animated.View>

      {loading && !data ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <LoadingState rows={3} />
        </View>
      ) : error && !data ? (
        <ErrorState title="Unable to load properties" error={error} onRetry={reload} />
      ) : (
        <>
          {featuredItems.length ? (
            <View style={styles.section}>
              <SectionTitle title={featuredTitle} action="View All" onAction={() => runSearch(data?.featured?.items?.length ? { featured: true } : {})} />
              <FlatList
                horizontal
                data={featuredItems}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                // Settle on a whole card after a swipe (card width + the rail's 12pt gap).
                snapToInterval={cardW + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.rail}
                renderItem={({ item }) => <FeaturedCard p={item} width={cardW} onOpen={openProperty} />}
              />
            </View>
          ) : null}

          {/* Home loan banner: opens the eligibility calculator (estimates, no lender offers). */}
          <PressableScale to={0.99} onPress={() => setLoanSheet("eligibility")} style={styles.loan} accessibilityRole="button" accessibilityLabel="Get your home loan easily. Check eligibility">
            <LinearGradient colors={["#F4EDFF", "#EADFFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Image source={HERO_IMAGE} style={styles.loanImage} resizeMode="cover" />
            <LinearGradient
              colors={["#F2EAFF", "rgba(242,234,255,0.7)", "rgba(242,234,255,0)"]}
              locations={[0, 0.4, 0.75]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.loanText}>
              <Text style={styles.loanTitle}>
                Get Your{"\n"}
                <Text style={{ color: brand.violet }}>Home Loan Easily</Text>
              </Text>
              <Text style={styles.loanSub}>Estimate your EMI and how much you could borrow — in seconds.</Text>
            </View>
            <View style={styles.loanSide}>
              <GlassView level="strong" borderRadius={12} style={styles.loanChip}>
                <Text style={styles.loanChipSmall}>Free estimate</Text>
                <Text style={styles.loanChipBig}>No sign-up</Text>
              </GlassView>
              <View style={styles.loanBtn}>
                <Text style={styles.loanBtnText}>Check Eligibility</Text>
                <Ionicons name="arrow-forward" size={13} color={brand.ink} />
              </View>
            </View>
          </PressableScale>

          {upcomingItems.length ? (
            <View style={styles.section}>
              <SectionTitle title="Upcoming Properties" action="View All" onAction={() => navigation.navigate("NewProject")} />
              <FlatList
                horizontal
                data={upcomingItems}
                keyExtractor={(i) => `u_${i.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
                renderItem={({ item }) => <UpcomingCard p={item} onOpen={openProperty} />}
              />
            </View>
          ) : null}

          <PressableScale to={0.99} onPress={() => setLoanSheet("emi")} style={styles.emiCard} accessibilityRole="button" accessibilityLabel="EMI calculator. Calculate your monthly EMI">
            <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emiIcon}>
              <Ionicons name="calculator" size={22} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.emiTitle}>EMI Calculator</Text>
              <Text style={styles.emiSub}>Calculate your monthly EMI and plan your budget.</Text>
            </View>
            <View style={styles.emiBtn}>
              <Text style={styles.emiBtnText}>Calculate EMI</Text>
              <Ionicons name="arrow-forward" size={13} color={brand.violet} />
            </View>
          </PressableScale>

          {priceData.length || stageData.some((s) => s.value > 0) ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Market Analytics
                </Text>
                <PressableScale onPress={() => navigation.navigate("Location")} style={styles.marketCity} accessibilityRole="button" accessibilityLabel={`Market: ${city || "All India"}. Change city`}>
                  <Text style={styles.marketCityText}>{city || "All India"}</Text>
                  <Ionicons name="chevron-down" size={12} color={brand.ink} />
                </PressableScale>
              </View>
              <View style={styles.chartsRow}>
                {priceData.length ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Price by BHK</Text>
                    <Text style={styles.chartSub}>Median asking price</Text>
                    <MiniLineChart key={`p_${city}`} data={priceData} formatValue={formatInr} />
                  </View>
                ) : null}
                {stageData.some((s) => s.value > 0) ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Listings by Stage</Text>
                    <Text style={styles.chartSub}>Active listings</Text>
                    <MiniBarChart key={`s_${city}`} data={stageData} formatValue={(v) => v.toLocaleString("en-IN")} unit="" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.chartNote}>
                Based on {insights.listings.toLocaleString("en-IN")} active listings{city ? ` in ${city}` : ""}. Tap a point or bar for its value.
              </Text>
            </View>
          ) : null}
        </>
      )}

      <LoanCalculatorSheet visible={!!loanSheet} initialTab={loanSheet || "emi"} onClose={() => setLoanSheet(null)} />

      <BottomSheet visible={recentOpen} onClose={() => setRecentOpen(false)} title="Recent Searches">
        {searchHistory.length ? (
          <>
            {searchHistory.slice(0, 10).map((item) => (
              <PressableScale
                key={item.id}
                onPress={() => {
                  setRecentOpen(false);
                  rerunSearch(item);
                }}
                style={styles.recentRow}
                accessibilityRole="button"
              >
                <Ionicons name="time-outline" size={18} color={brand.violet} />
                <Text style={styles.recentText} numberOfLines={1}>
                  {item.label || item.query}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={brand.inkSoft} />
              </PressableScale>
            ))}
            <PressableScale onPress={clearSearchHistory} style={styles.clearBtn} accessibilityRole="button">
              <Text style={styles.clearText}>Clear search history</Text>
            </PressableScale>
          </>
        ) : (
          <Text style={styles.emptyRecent}>Your searches will appear here.</Text>
        )}
      </BottomSheet>
    </Screen>
  );
}

const cardShadow = {
  shadowColor: brand.deep,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

const styles = StyleSheet.create({
  heroImageWrap: { position: "absolute", top: 0, right: 0, height: 270, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  heroWash: { backgroundColor: "rgba(190,160,255,0.22)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, minHeight: 48 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  cityPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, maxWidth: 150 },
  cityText: { fontSize: 13.5, fontWeight: "700", color: brand.ink, flexShrink: 1 },
  bell: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#E5484D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  bellBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  hero: { paddingHorizontal: 20, marginTop: 22 },
  h1: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, fontWeight: "700", color: brand.ink, letterSpacing: -0.8 },
  heroSub: { fontSize: 14.5, lineHeight: 21, color: brand.inkSoft, marginTop: 10 },
  searchBlock: { marginHorizontal: 20, marginTop: 20 },
  searchTabs: {
    ...surfaces.glassStrong,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 4,
  },
  searchTab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, minHeight: 44 },
  searchTabDivider: { width: 1, height: 16, backgroundColor: colors.line },
  searchTabText: { fontSize: 13, fontWeight: "700", color: brand.ink },
  search: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  searchAttached: { borderTopLeftRadius: 0 },
  searchSeam: { position: "absolute", top: -1, left: -1, height: 2, backgroundColor: surfaces.glassStrong.backgroundColor },
  searchInput: { flex: 1, fontSize: 14, color: brand.ink, minHeight: 44 },
  // 2 x 2 grid of wide shortcut cards: tinted icon tile + one-line label.
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginTop: 16 },
  quickTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE8FB",
    ...cardShadow,
  },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { flex: 1, fontSize: 13.5, fontWeight: "700", color: brand.ink },
  section: { marginTop: 26 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 21, fontWeight: "700", color: brand.ink, letterSpacing: -0.3 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  viewAllText: { fontSize: 13, fontWeight: "800", color: brand.violet },
  rail: { paddingHorizontal: 20, gap: 12, paddingBottom: 6 },
  fCard: { backgroundColor: "#FFFFFF", borderRadius: 26, padding: 8, borderWidth: 1, borderColor: "#F0EAFB", ...cardShadow },
  // Inset photo with its own rounded corners (the card's padding shows around it).
  fImageWrap: { borderRadius: 20, overflow: "hidden", backgroundColor: brand.lavender },
  fHeart: { position: "absolute", top: 8, right: 8 },
  fBody: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4 },
  fNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  fTitle: { flexShrink: 1, fontSize: 15.5, fontWeight: "800", color: brand.ink },
  fDesc: { fontSize: 12.5, lineHeight: 18, color: brand.inkSoft, marginTop: 4, minHeight: 36 },
  fPrice: { fontSize: 13, fontWeight: "800", color: brand.ink },
  fFoot: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  fStat: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 },
  fStatText: { fontSize: 11.5, fontWeight: "600", color: brand.inkSoft },
  fPill: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: brand.lavender },
  fPillText: { fontSize: 12.5, fontWeight: "800", color: brand.ink },
  loan: { marginHorizontal: 20, marginTop: 24, borderRadius: radius.xl, overflow: "hidden", flexDirection: "row", padding: 16, minHeight: 150, borderWidth: 1, borderColor: "#E6DAFF" },
  loanImage: { position: "absolute", right: 0, top: 0, bottom: 0, width: "58%", opacity: 0.9 },
  loanText: { flex: 1.25, justifyContent: "center", paddingRight: 8 },
  loanTitle: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, fontWeight: "700", color: brand.ink },
  loanSub: { fontSize: 12, lineHeight: 17, color: brand.inkSoft, marginTop: 6 },
  loanSide: { flex: 1, justifyContent: "space-between", alignItems: "flex-end" },
  loanChip: { paddingHorizontal: 10, paddingVertical: 6 },
  loanChipSmall: { fontSize: 10.5, color: brand.inkSoft, fontWeight: "600" },
  loanChipBig: { fontSize: 13, color: brand.violet, fontWeight: "800" },
  loanBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: brand.goldBright, paddingHorizontal: 12, height: 36, borderRadius: radius.pill },
  loanBtnText: { fontSize: 12.5, fontWeight: "800", color: brand.ink },
  uCard: { width: 236, flexDirection: "row", gap: 10, padding: 8, backgroundColor: "#FFFFFF", borderRadius: radius.lg, borderWidth: 1, borderColor: "#EFE8FB", ...cardShadow },
  uImage: { width: 72, height: 84, borderRadius: 12 },
  uBody: { flex: 1, justifyContent: "center" },
  uBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, marginBottom: 4 },
  uBadgeText: { fontSize: 10, fontWeight: "800" },
  uTitle: { fontSize: 13.5, fontWeight: "800", color: brand.ink },
  uMeta: { fontSize: 11.5, color: brand.inkSoft, marginTop: 1 },
  emiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 22,
    padding: 14,
    borderRadius: radius.lg,
    ...surfaces.glassStrong,
    ...cardShadow,
  },
  emiIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emiTitle: { fontSize: 15, fontWeight: "800", color: brand.ink },
  emiSub: { fontSize: 11.5, lineHeight: 16, color: brand.inkSoft, marginTop: 2 },
  emiBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1.4, borderColor: brand.violet, paddingHorizontal: 11, height: 36, borderRadius: radius.pill },
  emiBtnText: { fontSize: 12, fontWeight: "800", color: brand.violet },
  marketCity: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6DAFF", paddingHorizontal: 10, height: 32, borderRadius: radius.pill },
  marketCityText: { fontSize: 12.5, fontWeight: "700", color: brand.ink },
  // Charts stacked one under the other, each full width.
  chartsRow: { gap: 14, paddingHorizontal: 20 },
  chartCard: { backgroundColor: "#FFFFFF", borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: "#EFE8FB", ...cardShadow },
  chartTitle: { fontSize: 15, fontWeight: "800", color: brand.ink },
  chartSub: { fontSize: 12, color: brand.inkSoft, marginBottom: 10 },
  chartNote: { fontSize: 11.5, color: brand.inkSoft, paddingHorizontal: 20, marginTop: 10 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, borderBottomWidth: 1, borderBottomColor: "#F1ECFB" },
  recentText: { flex: 1, fontSize: 14.5, color: brand.ink, fontWeight: "600" },
  clearBtn: { alignSelf: "center", marginTop: 16, padding: 10 },
  clearText: { color: colors.error, fontWeight: "700", fontSize: 13.5 },
  emptyRecent: { color: brand.inkSoft, fontSize: 14, textAlign: "center", paddingVertical: 24 },
});
