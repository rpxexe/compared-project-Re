import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import SectionHeader from "../components/SectionHeader";
import PropertyCard from "../components/PropertyCard";
import CityPicker from "../components/CityPicker";
import PressableScale from "../components/PressableScale";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { useCity } from "../hooks/useCity";
import { useEntrance, usePulse } from "../hooks/useEntrance";
import { api } from "../services/api";
import { colors, fonts, glow, glowSubtle, radius, shadow } from "../theme";
import {
  getSearchHistory,
  getUserPreferences,
  subscribeSearchHistory,
  clearSearchHistory,
  addSearchHistory,
} from "../services/historyService";

const safe = (p) => p.catch(() => null);

const ROAD_REGEX =
  /\b(road|rd|marg|rasta|path|lane|gali|street|st|highway|expressway|flyover|bypass|ave|avenue|salai|circle|chowk|cross|main|layout)\b/i;

function getCleanLocalityAndCity(locationTitle, city, exactLocation) {
  let c = (city || "").trim();
  let t = (locationTitle || "").trim();
  const exact = (exactLocation || "").trim();

  if (t.includes(",")) {
    const parts = t
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const localities = parts.filter(
      (p) =>
        !ROAD_REGEX.test(p) &&
        p.toLowerCase() !== c.toLowerCase() &&
        p.toLowerCase() !== "india" &&
        !/^\d+$/.test(p),
    );
    if (localities.length > 0) {
      t = localities[localities.length - 1];
    } else {
      const nonCity = parts.filter((p) => p.toLowerCase() !== c.toLowerCase());
      t = nonCity[nonCity.length - 1] || parts[0];
    }
  } else if ((!t || ROAD_REGEX.test(t)) && exact) {
    const parts = exact
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const localities = parts.filter(
      (p) =>
        !ROAD_REGEX.test(p) &&
        p.toLowerCase() !== c.toLowerCase() &&
        p.toLowerCase() !== "india" &&
        !/^\d+$/.test(p),
    );
    if (localities.length > 0) {
      t = localities[0];
    }
  }

  if (t && c) {
    if (t.toLowerCase() === c.toLowerCase()) return c;
    if (
      t.toLowerCase().endsWith(", " + c.toLowerCase()) ||
      t.toLowerCase().endsWith(" " + c.toLowerCase())
    ) {
      t = t
        .substring(0, t.length - c.length)
        .replace(/,\s*$/, "")
        .trim();
    }
    return t ? `${t}, ${c}` : c;
  }

  if (t) return t;
  if (c) return c;
  return "All Locations";
}

// 5 categories directly from the middle phone design
const CATEGORIES = [
  { id: "Buy", label: "Buy", icon: "home" },
  { id: "Rent", label: "Rent", icon: "key-outline" },
  { id: "Projects", label: "Projects", icon: "layers-outline" },
  { id: "Commercial", label: "Commercial", icon: "business-outline" },
  { id: "Invest", label: "Invest", icon: "trending-up-outline" },
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [
    city,
    setCity,
    {
      detectingLocation,
      exactLocation,
      fullAddress,
      locationTitle,
      fetchCurrentLocation,
      setLocation,
    },
  ] = useCity();

  const [pickCity, setPickCity] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Buy");
  const [searchedText, setSearchedText] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [selectedLocality, setSelectedLocality] = useState("");

  const head = useEntrance(0, 12);
  const notifPulse = usePulse(0.92, 1.14, 1500);

  const displayLocation = useMemo(() => {
    if (detectingLocation || isLocatingGps) return "Detecting location...";
    if (selectedLocality && city) return `${selectedLocality}, ${city}`;
    if (!locationTitle && !city && !exactLocation) return "All Locations";
    return getCleanLocalityAndCity(locationTitle, city, exactLocation);
  }, [locationTitle, city, exactLocation, detectingLocation, isLocatingGps, selectedLocality]);

  // Load and subscribe to search history
  useEffect(() => {
    getSearchHistory().then(setSearchHistory).catch(() => {});
    const unsub = subscribeSearchHistory(setSearchHistory);
    return unsub;
  }, []);

  // Main data fetching based on current location and active category
  const { data, loading, error, reload, refresh } = useApi(async () => {
    const base = {};
    if (city) base.city = city;
    if (selectedLocality) base.locality = selectedLocality;

    if (activeCategory === "Commercial") {
      base.propertyType = "Commercial";
    } else if (activeCategory === "Rent") {
      base.condition = "rent";
    }

    const latestSearch = searchHistory[0];
    const historyParams = latestSearch?.query
      ? { search: latestSearch.query }
      : latestSearch?.locality
      ? { locality: latestSearch.locality }
      : latestSearch?.propertyType
      ? { propertyType: latestSearch.propertyType }
      : {};

    const [recent, featured, launch, upcoming, top, facets, historyProps] =
      await Promise.all([
        api.properties({ ...base, limit: 10 }),
        safe(api.properties({ ...base, featured: true, limit: 8 })),
        safe(api.properties({ ...base, section: "new-launch", limit: 8 })),
        safe(api.properties({ ...base, section: "upcoming", limit: 8 })),
        safe(api.topRated(8)),
        safe(api.facets()),
        latestSearch
          ? safe(api.properties({ ...historyParams, limit: 8 }))
          : Promise.resolve({ items: [] }),
      ]);

    return { recent, featured, launch, upcoming, top, facets, historyProps };
  }, [city, selectedLocality, activeCategory, searchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const first = (user?.name || "").split(" ")[0];
  const initial = (user?.name || user?.phone || "U").charAt(0).toUpperCase();
  const cities = data?.facets?.cities || [];

  // Instant GPS Location Fetching
  const handleInstantGpsFetch = async () => {
    if (isLocatingGps || detectingLocation) return;
    setIsLocatingGps(true);
    try {
      const res = await fetchCurrentLocation(cities);
      if (res?.city) {
        setSelectedLocality("");
      }
    } catch (err) {
      console.log("[HomeScreen] GPS detection error:", err?.message);
    } finally {
      setIsLocatingGps(false);
    }
  };

  // Submit search from pill bar
  const onSubmitSearch = () => {
    const q = (searchedText || "").trim();
    if (!q) {
      navigation.navigate("Explore");
      return;
    }
    addSearchHistory({
      query: q,
      city: city || "",
      locality: selectedLocality || "",
      propertyType: activeCategory === "Commercial" ? "Commercial" : "",
    });
    navigation.navigate("Search", {
      city: city || "",
      locality: selectedLocality || "",
      search: q,
      propertyType: activeCategory === "Commercial" ? "Commercial" : "",
    });
  };

  // Handle Category Click
  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    if (catId === "Projects") {
      navigation.navigate("NewProject");
    } else if (catId === "Invest") {
      navigation.navigate("Search", { city: city || "", sort: "rating" });
    }
  };

  // Re-run previous search
  const handleRecentSearchTap = (item) => {
    if (item.city) setCity(item.city);
    if (item.locality) setSelectedLocality(item.locality);
    navigation.navigate("Search", {
      city: item.city || city || "",
      locality: item.locality || "",
      search: item.query || "",
      propertyType: item.propertyType || "",
      bhk: item.bhk || "",
    });
  };

  const rail = (title, subtitle, res, actionLabel = "See all", action) => {
    const items = res?.items || [];
    if (!items.length) return null;
    return (
      <View style={{ marginTop: 26 }}>
        <SectionHeader
          title={title}
          subtitle={subtitle}
          action={action ? actionLabel : undefined}
          onAction={action}
        />
        <FlatList
          horizontal
          data={items}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          renderItem={({ item, index }) => (
            <PropertyCard property={item} variant="hero" index={index} />
          )}
        />
      </View>
    );
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* ======================================================
          1. TOP BRAND HEADER & PROFILE
      ====================================================== */}
      <Animated.View style={[styles.topHeader, head]}>
        <View style={styles.brandRow}>
          {/* Stylized App Icon Logo (Matches CP design) */}
          <LinearGradient
            colors={["#8B5CF6", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Text style={styles.logoBadgeText}>CP</Text>
          </LinearGradient>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.brandTitle}>Compare</Text>
            <Text style={styles.brandTitleSub}>Projects</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <PressableScale
            to={0.92}
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("Notification")}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            <Animated.View
              style={[
                styles.notificationDot,
                { transform: [{ scale: notifPulse }] },
              ]}
            >
              <Text style={styles.notificationDotText}>2</Text>
            </Animated.View>
          </PressableScale>

          <PressableScale
            to={0.92}
            style={styles.headerProfileBtn}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            {user ? (
              <LinearGradient
                colors={["#8B5CF6", "#7C3AED"]}
                style={styles.avatarCircle}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={18} color="#6D28D9" />
              </View>
            )}
          </PressableScale>
        </View>
      </Animated.View>

      {/* ======================================================
          2. LOCATION FETCHING & SELECTION BAR (Unified Pill with GPS inside)
      ====================================================== */}
      <View style={styles.locationBarWrapper}>
        <View style={styles.locationPill}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate("Location")}
            style={styles.locationMainPressable}
            accessibilityRole="button"
            accessibilityLabel="Change location"
          >
            <View style={styles.locationPinIconBox}>
              <Ionicons name="location" size={14} color="#FFFFFF" />
            </View>
            <View style={styles.locationTextBox}>
              <Text style={styles.locationSubText}>CURRENT LOCATION</Text>
              <Text style={styles.locationMainText} numberOfLines={1} ellipsizeMode="tail">
                {displayLocation}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={13} color="#6D28D9" style={styles.locationChevron} />
          </TouchableOpacity>

          {/* Vertical subtle divider */}
          <View style={styles.locationDivider} />

          {/* 1-Tap Instant Live GPS Locate Button Placed INSIDE Location Section */}
          <PressableScale
            to={0.88}
            onPress={handleInstantGpsFetch}
            style={styles.gpsInsideBtn}
            accessibilityRole="button"
            accessibilityLabel="Detect live GPS location"
          >
            {isLocatingGps || detectingLocation ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Ionicons name="locate" size={18} color="#7C3AED" />
            )}
          </PressableScale>
        </View>
      </View>

      {/* ======================================================
          3. HERO BANNER: "Find Your Next Home"
      ====================================================== */}
      <View style={styles.heroSection}>
        {/* Modern Penthouse Terrace Illustration Floating in Top-Right */}
        <View style={styles.heroImageWrapper} pointerEvents="none">
          <Image
            source={require("../../assets/hero_luxury_home.jpg")}
            style={styles.heroBuildingImage}
            resizeMode="cover"
          />
          {/* Subtle gradient overlay to blend into background */}
          <LinearGradient
            colors={[
              colors.ivory,
              "rgba(248, 245, 255, 0.4)",
              "transparent",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "transparent",
              colors.ivory,
            ]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <Text style={styles.heroUppercaseTag}>
          DISCOVER  ·  COMPARE  ·  VISIT  ·  OWN
        </Text>
        <Text style={styles.heroMainTitle}>
          Find Your{"\n"}Next{" "}
          <Text style={styles.heroHighlightText}>Home</Text>
        </Text>
        <Text style={styles.heroSubText}>
          AI-powered property discovery, comparison and buying journey.
        </Text>
      </View>

      {/* ======================================================
          4. PILL SEARCH BAR (With Glow & Mic Icon)
      ====================================================== */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchPill}>
          <Ionicons name="sparkles" size={19} color="#8B5CF6" style={{ marginLeft: 6, marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location, project, builder..."
            placeholderTextColor="#8F83A8"
            value={searchedText}
            onChangeText={setSearchedText}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={onSubmitSearch}
            style={styles.micBtn}
            accessibilityLabel="Voice search"
          >
            <Ionicons name="mic-outline" size={21} color="#6D28D9" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================
          5. CATEGORY CIRCULAR BUTTONS ROW (Buy, Rent, Projects, Commercial, Invest)
      ====================================================== */}
      <View style={styles.categoriesRow}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <PressableScale
              key={cat.id}
              to={0.92}
              onPress={() => handleSelectCategory(cat.id)}
              style={styles.categoryItem}
            >
              {isActive ? (
                <LinearGradient
                  colors={["#8B5CF6", "#6D28D9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.categoryCircleActive, glowSubtle]}
                >
                  <Ionicons name={cat.icon} size={24} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View style={styles.categoryCircleInactive}>
                  <Ionicons name={cat.icon} size={23} color="#4C1D95" />
                </View>
              )}
              <Text
                style={[
                  styles.categoryLabel,
                  isActive && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ======================================================
          6. SEARCH HISTORY SECTION & RECENT SEARCH CHIPS
          (Displays properties based on user's recent searches)
      ====================================================== */}
      {searchHistory.length > 0 ? (
        <View style={styles.historySection}>
          <View style={styles.historyHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="time-outline" size={17} color="#6D28D9" style={{ marginRight: 6 }} />
              <Text style={styles.historySectionTitle}>Based on Your Search History</Text>
            </View>
            <TouchableOpacity onPress={clearSearchHistory}>
              <Text style={styles.clearHistoryLink}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyChipsScroll}
          >
            {searchHistory.slice(0, 6).map((item) => (
              <PressableScale
                key={item.id}
                to={0.94}
                onPress={() => handleRecentSearchTap(item)}
                style={styles.historyChip}
              >
                <Ionicons name="search" size={12} color="#7C3AED" style={{ marginRight: 5 }} />
                <Text style={styles.historyChipText} numberOfLines={1}>
                  {item.label}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          {/* Property carousel tailored to search history */}
          {data?.historyProps?.items?.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <FlatList
                horizontal
                data={data.historyProps.items}
                keyExtractor={(i) => `hist_${i.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                renderItem={({ item, index }) => (
                  <PropertyCard property={item} variant="hero" index={index} />
                )}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ======================================================
          9. PROPERTY RAILS (Location based, New Launches, Top Rated)
      ====================================================== */}
      {loading && !data ? (
        <View style={{ padding: 20, paddingTop: 28 }}>
          <LoadingState rows={3} />
        </View>
      ) : error && !data ? (
        <ErrorState
          title="Unable to load properties"
          error={error}
          onRetry={reload}
        />
      ) : (
        <>
          {/* Featured in current Location */}
          {rail(
            selectedLocality
              ? `Featured in ${selectedLocality}`
              : city
              ? `Featured in ${city}`
              : "Featured Properties",
            "Hand-picked for your lifestyle",
            data.featured,
            "See all",
            () =>
              navigation.navigate("Search", {
                city: city || "",
                locality: selectedLocality || "",
                featured: true,
              }),
          )}

          {/* New Launches */}
          {rail(
            "New Launches",
            city ? `Fresh projects in ${city}` : "Fresh projects in the market",
            data.launch,
            "Explore",
            () => navigation.navigate("NewProject"),
          )}

          {/* Top Rated */}
          {data.top?.items?.length
            ? rail(
                "Top Rated Projects",
                "Loved by buyers on Compare Project",
                data.top,
                "See all",
                () =>
                  navigation.navigate("Search", {
                    city: city || "",
                    sort: "rating",
                  }),
              )
            : null}

          {/* Upcoming */}
          {rail(
            "Upcoming Projects",
            "Plan ahead and invest early",
            data.upcoming,
            "Explore",
            () => navigation.navigate("NewProject"),
          )}

          {/* Post Property Banner */}
          <PressableScale
            to={0.98}
            onPress={() => navigation.navigate("Post")}
            style={styles.postCtaContainer}
          >
            <LinearGradient
              colors={["#2A1060", colors.ink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flex: 1, zIndex: 1 }}>
              <Text style={styles.postCtaTitle}>Have a property to sell?</Text>
              <Text style={styles.postCtaSub}>
                Post it in minutes and reach thousands of verified buyers.
              </Text>
            </View>
            <View style={[styles.postCtaAddBtn, glow]}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          </PressableScale>
        </>
      )}

      {/* City Picker Modal */}
      <CityPicker
        visible={pickCity}
        onClose={() => setPickCity(false)}
        cities={cities}
        value={city}
        onSelect={(c) => {
          setCity(c);
          setSelectedLocality("");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 1. Top Header
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#180D33",
    lineHeight: 17,
    letterSpacing: -0.3,
  },
  brandTitleSub: {
    fontSize: 15,
    fontWeight: "800",
    color: "#6D28D9",
    lineHeight: 17,
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1.2,
    borderColor: "rgba(224, 215, 248, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glass,
  },
  notificationDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDotText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
  },
  headerProfileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1.2,
    borderColor: "rgba(224, 215, 248, 0.9)",
    ...shadow.glass,
  },
  avatarCircle: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. Location Bar
  locationBarWrapper: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.2,
    borderColor: "rgba(215, 200, 248, 0.85)",
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: radius.pill,
    ...shadow.glass,
  },
  locationMainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  locationPinIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  locationTextBox: {
    flex: 1,
    marginLeft: 8,
    marginRight: 4,
    justifyContent: "center",
  },
  locationSubText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#8B5CF6",
    letterSpacing: 0.8,
  },
  locationMainText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#180D33",
    marginTop: 1,
  },
  locationChevron: {
    marginRight: 6,
    marginLeft: 2,
  },
  locationDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(215, 200, 248, 0.7)",
    marginRight: 4,
  },
  gpsInsideBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // 3. Hero Section
  heroSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    position: "relative",
    minHeight: 125,
    justifyContent: "center",
  },
  heroImageWrapper: {
    position: "absolute",
    right: 0,
    top: -10,
    width: 175,
    height: 155,
    borderRadius: 20,
    overflow: "hidden",
  },
  heroBuildingImage: {
    width: "100%",
    height: "100%",
  },
  heroUppercaseTag: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#7E7398",
    letterSpacing: 1.8,
  },
  heroMainTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#180D33",
    lineHeight: 37,
    marginTop: 4,
    maxWidth: 240,
    letterSpacing: -0.5,
  },
  heroHighlightText: {
    color: "#8B5CF6",
  },
  heroSubText: {
    fontSize: 13,
    color: "#6E6285",
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 220,
  },

  // 4. Search Bar
  searchBarWrapper: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1.5,
    borderColor: "#D8B4FE",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#180D33",
    fontWeight: "500",
    paddingVertical: 2,
  },
  micBtn: {
    padding: 4,
    marginLeft: 6,
  },

  // 5. Category Icons Row
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  categoryItem: {
    alignItems: "center",
    width: 62,
  },
  categoryCircleActive: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  categoryCircleInactive: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.2,
    borderColor: "rgba(215, 200, 248, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glass,
  },
  categoryLabel: {
    fontSize: 12,
    color: "#5B4F73",
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  categoryLabelActive: {
    color: "#6D28D9",
    fontWeight: "800",
  },

  // 6. Search History Section
  historySection: {
    marginTop: 26,
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#180D33",
  },
  clearHistoryLink: {
    fontSize: 12,
    color: "#8B5CF6",
    fontWeight: "700",
  },
  historyChipsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  historyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1.2,
    borderColor: "rgba(196, 181, 253, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    ...shadow.glass,
  },
  historyChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B2667",
    maxWidth: 150,
  },

  // Post Property CTA
  postCtaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1.2,
    borderColor: "rgba(199, 125, 255, 0.45)",
    overflow: "hidden",
    position: "relative",
    ...shadow.glassFloat,
  },
  postCtaTitle: {
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 19,
  },
  postCtaSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12.5,
    marginTop: 4,
  },
  postCtaAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    marginLeft: 12,
  },
});
