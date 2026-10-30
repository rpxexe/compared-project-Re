import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, glass } from "../theme";
import Screen from "../components/Screen";
import { useCity } from "../hooks/useCity";
import { api } from "../services/api";
import {
  POPULAR_CITIES,
  searchIndiaLocations,
} from "../services/locationService";
import Text, { AppTextInput as TextInput } from "../components/AppText";

export default function LocationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [
    city,
    setCity,
    { exactLocation, fullAddress, locationTitle, setLocation, fetchCurrentLocation },
  ] = useCity();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [dbLocations, setDbLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalLocations, setTotalLocations] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const PAGE_LIMIT = 15;

  // Fetch verified project localities from database in optimized 15-item batches
  useEffect(() => {
    let active = true;
    async function loadDbLocations() {
      setLoadingLocations(true);
      try {
        const res = await api.locations({ limit: PAGE_LIMIT, page: 1 });
        if (active) {
          const list = Array.isArray(res) ? res : res?.locations || [];
          setDbLocations(list);
          setHasMore(!!res?.hasMore);
          setTotalLocations(res?.total || list.length);
          setPage(1);
        }
      } catch (err) {
        console.log("[LocationScreen] Error fetching DB locations:", err?.message);
      } finally {
        if (active) setLoadingLocations(false);
      }
    }
    loadDbLocations();
    return () => {
      active = false;
    };
  }, []);

  // Fetch next batch of 15 locations when user taps "More Locations"
  const handleLoadMoreLocations = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.locations({ limit: PAGE_LIMIT, page: nextPage });
      const nextList = Array.isArray(res) ? res : res?.locations || [];
      if (nextList.length > 0) {
        setDbLocations((prev) => [...prev, ...nextList]);
        setPage(nextPage);
        setHasMore(!!res?.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.log("[LocationScreen] Error loading more locations:", err?.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Live debounced India geocoding search (like Zomato / Rapido)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchIndiaLocations(q);
        if (active) {
          setSearchResults(list);
        }
      } catch (err) {
        console.log("[LocationScreen] Search error:", err?.message);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Filter database locations based on search query
  const filteredDbLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dbLocations;
    return dbLocations.filter((item) => {
      const loc = (item.locality || "").toLowerCase();
      const c = (item.city || "").toLowerCase();
      const f = (item.formatted || "").toLowerCase();
      return loc.includes(q) || c.includes(q) || f.includes(q);
    });
  }, [dbLocations, searchQuery]);

  // Handle GPS Current Location
  const handleFetchCurrentLocation = async () => {
    setIsLocating(true);
    setLocationError("");
    Keyboard.dismiss();

    try {
      const result = await fetchCurrentLocation();
      if (result && (result.fullAddress || result.exactLocation || result.city)) {
        navigation.goBack();
      } else {
        setLocationError("Could not detect GPS address. Please search above.");
      }
    } catch (err) {
      setLocationError(err?.message || "Location access failed. Please search above.");
    } finally {
      setIsLocating(false);
    }
  };

  // Handle selecting an Indian location suggestion from search (Zomato / Rapido)
  const handleSelectSuggestion = (item) => {
    Keyboard.dismiss();
    const full = item.fullAddress || [item.title, item.subtitle].filter(Boolean).join(", ");
    const c = item.city || "";
    const t = item.locality || item.title || "";
    setLocation(full, c, t);
    navigation.goBack();
  };

  // Handle selecting a database project location
  const handleSelectDbLocation = (item) => {
    Keyboard.dismiss();
    const full = item.formatted || [item.locality, item.city].filter(Boolean).join(", ");
    const c = item.city || item.locality;
    const t = item.locality || item.city;
    setLocation(full, c, t);
    navigation.goBack();
  };

  // Handle selecting a metro chip
  const handleSelectMetro = (metro) => {
    Keyboard.dismiss();
    setLocation(metro, metro, metro);
    navigation.goBack();
  };

  // Handle selecting All Locations
  const handleSelectAllLocations = () => {
    Keyboard.dismiss();
    setLocation("", "", "");
    navigation.goBack();
  };

  const trimmedQuery = searchQuery.trim();
  const isSearchActive = trimmedQuery.length >= 2;
  const currentDisplay = locationTitle || exactLocation || city;

  return (
    <Screen scroll={false} padTop={false} padBottom={false} style={styles.root}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Select Location</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {currentDisplay
                ? `Current: ${currentDisplay}`
                : "Search road, locality, or city across India"}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={19}
            color={colors.goldDeep}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search road, area, city in India..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (locationError) setLocationError("");
            }}
            returnKeyType="search"
            autoCapitalize="words"
            autoCorrect={false}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.goldDeep} style={{ marginRight: 6 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===================== SEARCH MODE ===================== */}
        {isSearchActive ? (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>SEARCH RESULTS (INDIA)</Text>
              {isSearching ? (
                <Text style={styles.searchingBadge}>Searching...</Text>
              ) : (
                <Text style={styles.countBadge}>
                  {searchResults.length + filteredDbLocations.length} results
                </Text>
              )}
            </View>

            {/* Live Indian Places from Geocoder */}
            {searchResults.map((item, index) => {
              return (
                <TouchableOpacity
                  key={item.id || `search-${index}`}
                  activeOpacity={0.7}
                  onPress={() => handleSelectSuggestion(item)}
                  style={styles.resultItem}
                >
                  <View style={styles.pinCircle}>
                    <Ionicons name="location" size={19} color={colors.goldDeep} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.resultSubtitle} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ opacity: 0.6 }} />
                </TouchableOpacity>
              );
            })}

            {/* Matching database project locations */}
            {filteredDbLocations.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text style={styles.sectionHeading}>
                  PROJECT DATABASE LOCALITIES ({filteredDbLocations.length})
                </Text>
                {filteredDbLocations.slice(0, 15).map((item, index) => (
                  <TouchableOpacity
                    key={`db-search-${item.city}-${item.locality}-${index}`}
                    activeOpacity={0.7}
                    onPress={() => handleSelectDbLocation(item)}
                    style={styles.resultItem}
                  >
                    <View style={[styles.pinCircle, { backgroundColor: colors.champagneSoft }]}>
                      <Ionicons name="business" size={18} color={colors.goldDeep} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {item.locality || item.city}
                      </Text>
                      {item.city ? (
                        <Text style={styles.resultSubtitle} numberOfLines={1}>
                          {item.city}, India
                        </Text>
                      ) : null}
                    </View>

                    {item.count ? (
                      <View style={styles.propCountPill}>
                        <Text style={styles.propCountText}>
                          {item.count} {item.count === 1 ? "property" : "properties"}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Empty state when no Indian results are found */}
            {!isSearching &&
              searchResults.length === 0 &&
              filteredDbLocations.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="location-outline"
                    size={36}
                    color={colors.muted}
                    style={{ opacity: 0.6 }}
                  />
                  <Text style={styles.emptyTitle}>
                    No locations found in India for "{searchQuery}"
                  </Text>
                  <Text style={styles.emptySub}>
                    Try searching by road name, locality, landmark, city, or state.
                  </Text>
                </View>
              )}
          </View>
        ) : (
          /* ===================== DEFAULT VIEW ===================== */
          <View>
            {/* 1. FETCH CURRENT LOCATION (GPS) */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleFetchCurrentLocation}
              disabled={isLocating}
              style={styles.currentLocationCard}
            >
              <View style={styles.gpsIconCircle}>
                {isLocating ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="navigate" size={20} color={colors.white} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.gpsTitleRow}>
                  <Text style={styles.gpsTitle}>Use Current Location</Text>
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>GPS</Text>
                  </View>
                </View>
                <Text style={styles.gpsSub} numberOfLines={2}>
                  {isLocating
                    ? "Locating you & detecting address..."
                    : locationError
                    ? locationError
                    : "Auto-detect your exact locality & full address"}
                </Text>
              </View>

              <Ionicons
                name={isLocating ? "hourglass-outline" : "chevron-forward"}
                size={18}
                color={colors.goldDeep}
              />
            </TouchableOpacity>

            {/* 2. ALL LOCATIONS OPTION */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSelectAllLocations}
              style={[
                styles.allLocationsRow,
                !currentDisplay && styles.allLocationsActive,
              ]}
            >
              <View style={styles.globeIconCircle}>
                <Ionicons name="globe-outline" size={20} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.allLocationsTitle,
                    !currentDisplay && { color: colors.goldDeep },
                  ]}
                >
                  All Locations
                </Text>
                <Text style={styles.allLocationsSub}>
                  Browse properties and projects across all of India
                </Text>
              </View>
              {!currentDisplay && (
                <View style={styles.checkPill}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>

            {/* 3. POPULAR METROS */}
            <View style={styles.metrosSection}>
              <Text style={styles.sectionHeading}>POPULAR CITIES</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.metrosScroll}
              >
                {POPULAR_CITIES.map((metro) => {
                  const isSelected =
                    currentDisplay === metro || city === metro;
                  return (
                    <TouchableOpacity
                      key={metro}
                      activeOpacity={0.7}
                      onPress={() => handleSelectMetro(metro)}
                      style={[styles.metroChip, isSelected && styles.metroChipActive]}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.white}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.metroText,
                          isSelected && styles.metroTextActive,
                        ]}
                      >
                        {metro}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 4. REAL DATABASE LOCALITIES */}
            <View style={styles.dbListSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>
                  POPULAR REAL ESTATE LOCALITIES
                </Text>
                {dbLocations.length > 0 && (
                  <Text style={styles.countBadge}>
                    Showing {dbLocations.length}{totalLocations ? ` of ${totalLocations}` : ""}
                  </Text>
                )}
              </View>

              {loadingLocations ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={colors.goldDeep} />
                  <Text style={styles.loadingText}>Loading verified locations...</Text>
                </View>
              ) : (
                <>
                  {dbLocations.map((item, index) => {
                    const formatted =
                      item.formatted ||
                      [item.locality, item.city].filter(Boolean).join(", ");
                    const isSelected =
                      exactLocation === formatted ||
                      fullAddress === formatted ||
                      (city === item.city && !item.locality);

                    return (
                      <TouchableOpacity
                        key={`db-${item.city}-${item.locality}-${index}`}
                        activeOpacity={0.7}
                        onPress={() => handleSelectDbLocation(item)}
                        style={[
                          styles.locationItem,
                          isSelected && styles.locationItemActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.locPinWrap,
                            isSelected && { backgroundColor: colors.champagneSoft },
                          ]}
                        >
                          <Ionicons
                            name="location"
                            size={18}
                            color={isSelected ? colors.goldDeep : colors.muted}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.locItemTitle,
                              isSelected && styles.locItemTitleActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.locality || item.city}
                          </Text>
                          {item.locality && item.city ? (
                            <Text style={styles.locItemSub}>{item.city}, India</Text>
                          ) : null}
                        </View>

                        {item.count ? (
                          <View style={styles.propCountPill}>
                            <Text style={styles.propCountText}>
                              {item.count} {item.count === 1 ? "property" : "properties"}
                            </Text>
                          </View>
                        ) : null}

                        {isSelected && (
                          <View style={styles.checkPill}>
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* "More Locations" Button */}
                  {hasMore && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleLoadMoreLocations}
                      disabled={loadingMore}
                      style={styles.moreLocationsBtn}
                    >
                      {loadingMore ? (
                        <View style={styles.moreLocationsContent}>
                          <ActivityIndicator size="small" color={colors.goldDeep} />
                          <Text style={styles.moreLocationsText}>Loading more locations...</Text>
                        </View>
                      ) : (
                        <View style={styles.moreLocationsContent}>
                          <Ionicons
                            name="add-circle-outline"
                            size={18}
                            color={colors.goldDeep}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.moreLocationsText}>More Locations</Text>
                          <Ionicons
                            name="chevron-down"
                            size={15}
                            color={colors.goldDeep}
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    ...shadow.card,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.champagneSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    fontFamily: fonts.serif,
  },
  headerSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.line,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: colors.ink,
    height: "100%",
  },
  clearBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  /* Section headers */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  countBadge: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.goldDeep,
  },
  searchingBadge: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.muted,
  },
  /* Search Results Items (Zomato / Rapido style) */
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
    ...shadow.card,
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.champagneSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  resultSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  /* GPS Card */
  currentLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 12,
    gap: 12,
    ...shadow.glass,
  },
  gpsIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.goldDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gpsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  gpsBadge: {
    backgroundColor: colors.champagneSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  gpsBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.goldDeep,
  },
  gpsSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  /* All locations */
  allLocationsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    gap: 12,
    ...shadow.glass,
  },
  allLocationsActive: {
    borderColor: colors.goldDeep,
    backgroundColor: "rgba(253, 248, 237, 0.92)",
  },
  globeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.champagneSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  allLocationsTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.ink,
  },
  allLocationsSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  checkPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.goldDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Metros Section */
  metrosSection: {
    marginBottom: 18,
  },
  metrosScroll: {
    gap: 8,
    paddingTop: 4,
  },
  metroChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    ...shadow.glass,
  },
  metroChipActive: {
    backgroundColor: colors.goldDeep,
    borderColor: colors.goldDeep,
  },
  metroText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  metroTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  /* DB List Section */
  dbListSection: {
    marginTop: 4,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    gap: 12,
    ...shadow.glass,
  },
  locationItemActive: {
    backgroundColor: "rgba(253, 248, 237, 0.92)",
    borderColor: colors.gold,
  },
  locPinWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ivory,
    alignItems: "center",
    justifyContent: "center",
  },
  locItemTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.ink,
  },
  locItemTitleActive: {
    color: colors.goldDeep,
    fontWeight: "800",
  },
  locItemSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  propCountPill: {
    backgroundColor: colors.ivory,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  propCountText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.muted,
  },
  moreLocationsBtn: {
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1.4,
    borderColor: "rgba(139, 92, 246, 0.35)",
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glass,
  },
  moreLocationsContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moreLocationsText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.goldDeep,
  },
});
