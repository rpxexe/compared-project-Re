import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "./BottomSheet";
import { colors, fonts, radius } from "../theme";
import {
  getCurrentUserLocation,
  POPULAR_CITIES,
} from "../services/locationService";
import Text, { AppTextInput as TextInput } from "./AppText";

export default function CityPicker({
  visible,
  onClose,
  cities = [],
  value,
  onSelect,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Combined list of cities without duplicates
  const allKnownCities = useMemo(() => {
    const set = new Set([...cities, ...POPULAR_CITIES]);
    return Array.from(set).filter(Boolean);
  }, [cities]);

  // Filtered list based on user search query
  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allKnownCities;
    return allKnownCities.filter((c) => c.toLowerCase().includes(q));
  }, [allKnownCities, searchQuery]);

  // Handle GPS / Network Current Location Detection
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationError("");
    Keyboard.dismiss();

    try {
      const result = await getCurrentUserLocation(cities);
      if (result && result.city) {
        onSelect(result.city);
        onClose();
      } else {
        setLocationError("Could not detect city. Please enter manually.");
      }
    } catch (err) {
      setLocationError(
        err?.message || "Location access unavailable. Please enter manually."
      );
    } finally {
      setIsLocating(false);
    }
  };

  // Handle manual location selection
  const handleSelectLocation = (selectedLocation) => {
    Keyboard.dismiss();
    onSelect(selectedLocation);
    onClose();
  };

  const trimmedQuery = searchQuery.trim();
  const showManualApply =
    trimmedQuery.length > 0 &&
    !allKnownCities.some(
      (c) => c.toLowerCase() === trimmedQuery.toLowerCase()
    );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Location"
      maxHeight={0.88}
    >
      <View style={styles.container}>
        {/* Subtitle */}
        <Text style={styles.subhead}>
          Find verified properties & projects in your area
        </Text>

        {/* 1. USE CURRENT LOCATION CARD */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
          style={styles.currentLocationCard}
        >
          <View style={styles.gpsIconCircle}>
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="navigate" size={18} color={colors.white} />
            )}
          </View>

          <View style={styles.currentLocationTextWrap}>
            <View style={styles.currentLocationTitleRow}>
              <Text style={styles.currentLocationTitle}>
                Use Current Location
              </Text>
              <View style={styles.gpsPill}>
                <Text style={styles.gpsPillText}>GPS</Text>
              </View>
            </View>
            <Text style={styles.currentLocationSub}>
              {isLocating
                ? "Fetching your live coordinates..."
                : locationError
                ? locationError
                : "Auto-detect city via device GPS & Network"}
            </Text>
          </View>

          <View style={styles.currentLocationArrow}>
            <Ionicons
              name={isLocating ? "hourglass-outline" : "chevron-forward"}
              size={18}
              color={colors.goldDeep}
            />
          </View>
        </TouchableOpacity>

        {/* 2. MANUAL SEARCH & ENTRY INPUT */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.goldDeep}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search or enter location manually..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (locationError) setLocationError("");
            }}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (trimmedQuery) {
                handleSelectLocation(trimmedQuery);
              }
            }}
            clearButtonMode="while-editing"
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. DYNAMIC MANUAL APPLY CARD (When user types a custom locality/city) */}
        {trimmedQuery.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSelectLocation(trimmedQuery)}
            style={styles.manualApplyCard}
          >
            <View style={styles.manualApplyIconCircle}>
              <Ionicons name="location" size={18} color={colors.goldDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualApplyCaption}>ENTERED LOCATION</Text>
              <Text style={styles.manualApplyValue} numberOfLines={1}>
                {trimmedQuery}
              </Text>
            </View>
            <View style={styles.manualApplyActionBadge}>
              <Ionicons name="checkmark" size={15} color={colors.white} />
              <Text style={styles.manualApplyActionText}>Set Location</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 4. POPULAR QUICK CITY CHIPS (when not actively searching) */}
        {!trimmedQuery && (
          <View style={styles.popularSection}>
            <Text style={styles.sectionTitle}>POPULAR METROS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {POPULAR_CITIES.slice(0, 8).map((metro) => {
                const isSelected = value === metro;
                return (
                  <TouchableOpacity
                    key={metro}
                    activeOpacity={0.7}
                    onPress={() => handleSelectLocation(metro)}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                    ]}
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
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}
                    >
                      {metro}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 5. ALL LOCATIONS OPTION */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSelectLocation("")}
          style={[styles.row, !value && styles.rowActive]}
        >
          <View
            style={[
              styles.rowIconWrap,
              !value && { backgroundColor: colors.champagneSoft },
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={18}
              color={!value ? colors.goldDeep : colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowText, !value && styles.rowTextActive]}>
              All Locations
            </Text>
            <Text style={styles.rowSub}>
              Browse all properties across all cities
            </Text>
          </View>
          {!value && (
            <View style={styles.activeCheckCircle}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* 6. AVAILABLE CITIES LIST */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
          {trimmedQuery ? "MATCHING LOCATIONS" : "ALL AVAILABLE CITIES"}
        </Text>

        <FlatList
          data={filteredCities}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="location-outline"
                size={34}
                color={colors.muted}
                style={{ opacity: 0.6, marginBottom: 8 }}
              />
              <Text style={styles.emptyTitle}>
                No preset city matching "{searchQuery}"
              </Text>
              <Text style={styles.emptySub}>
                You can still tap "Set Location" above to use your custom
                entered location.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = item === value;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelectLocation(item)}
                style={[styles.row, isSelected && styles.rowActive]}
              >
                <View
                  style={[
                    styles.rowIconWrap,
                    isSelected && { backgroundColor: colors.champagneSoft },
                  ]}
                >
                  <Ionicons
                    name="location"
                    size={18}
                    color={isSelected ? colors.goldDeep : colors.muted}
                  />
                </View>
                <Text style={[styles.rowText, isSelected && styles.rowTextActive]}>
                  {item}
                </Text>
                {isSelected && (
                  <View style={styles.activeCheckCircle}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 4,
  },
  subhead: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 14,
    marginTop: -4,
  },
  /* Current Location Card */
  currentLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.champagneSoft,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gpsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldDeep,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  currentLocationTextWrap: {
    flex: 1,
  },
  currentLocationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  gpsPill: {
    backgroundColor: colors.champagneSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  gpsPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.goldDeep,
    letterSpacing: 0.5,
  },
  currentLocationSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  currentLocationArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.champagneSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  /* Manual Search Box */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
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
  /* Dynamic Manual Apply Card */
  manualApplyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.champagneSoft,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: 14,
    gap: 10,
  },
  manualApplyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  manualApplyCaption: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.goldDeep,
    letterSpacing: 0.8,
  },
  manualApplyValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 1,
  },
  manualApplyActionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.goldDeep,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 4,
  },
  manualApplyActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  /* Popular Cities Section */
  popularSection: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.goldDeep,
    borderColor: colors.goldDeep,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  /* List Rows */
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    marginBottom: 4,
    gap: 12,
  },
  rowActive: {
    backgroundColor: colors.champagneSoft,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  rowTextActive: {
    fontWeight: "800",
    color: colors.goldDeep,
  },
  rowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  activeCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.goldDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Empty State */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17,
  },
});
