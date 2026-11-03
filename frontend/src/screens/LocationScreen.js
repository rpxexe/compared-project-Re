import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSpace } from "../hooks/useBottomSpace";
import { useFloat } from "../hooks/useEntrance";
import { isReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "../components/PressableScale";
import CityLandmark from "../components/CityLandmark";
import Reveal, { stagger } from "../components/Reveal";
import { useCity } from "../hooks/useCity";
import { useLocationAccess } from "../context/LocationAccessContext";
import { api } from "../services/api";
import { POPULAR_CITIES, searchIndiaLocations } from "../services/locationService";
import { brand, colors, radius, shadow } from "../theme";
import Text, { AppTextInput as TextInput } from "../components/AppText";

const RECENTS_KEY = "cp_recent_locations";
const MAX_RECENTS = 6;

// Locations picked on this screen, newest first: [{ full, city, title }].
async function loadRecents() {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(RECENTS_KEY)) || "[]");
    return Array.isArray(list) ? list.filter((r) => r && (r.full || r.city)) : [];
  } catch {
    return [];
  }
}
function saveRecents(list) {
  AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list)).catch(() => {});
}

// Pick where to browse: GPS, all of India, a popular city, a recent pick, or any place in India by
// search (which also finds localities that have listings). Every pick sets the shared location
// (useCity) and closes the screen.
// Motion: header band with a floating pin, compass on the GPS button, cities popping in,
// staggered rows, a crossfade between browsing and searching, and shimmer rows while searching.
export default function LocationScreen({ navigation }) {
  const { ensureLocation } = useLocationAccess();
  const insets = useSafeAreaInsets();
  const { bottom } = useBottomSpace();
  const [city, , { exactLocation, fullAddress, locationTitle, setLocation, fetchCurrentLocation }] = useCity();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [localityMatches, setLocalityMatches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recents, setRecents] = useState(null); // null until loaded
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  // Header height and keyboard height place and size the recent-searches card.
  const [bandHeight, setBandHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height } = useWindowDimensions();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    let active = true;
    loadRecents().then((list) => active && setRecents(list));
    return () => { active = false; };
  }, []);

  // Android's back button hides the keyboard without blurring the field; treat that as leaving
  // the search box, so the recent-searches view closes too.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      searchRef.current?.blur();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // While typing: places anywhere in India (geocoder) and localities that have listings, debounced.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setLocalityMatches([]);
      setIsSearching(false);
      return undefined;
    }
    let active = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const [places, localities] = await Promise.all([
        searchIndiaLocations(q).catch((err) => {
          console.log("[LocationScreen] Search error:", err?.message);
          return [];
        }),
        api.locations({ search: q, limit: 6 }).then((r) => (Array.isArray(r) ? r : r?.locations || [])).catch(() => []),
      ]);
      if (!active) return;
      setSearchResults(places);
      setLocalityMatches(localities);
      setIsSearching(false);
    }, 280);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const query = searchQuery.trim();

  const remember = (entry) => {
    if (!entry.full && !entry.city) return; // "All of India" isn't a place to come back to
    const key = (entry.full || entry.city).toLowerCase();
    const next = [entry, ...(recents || []).filter((r) => (r.full || r.city).toLowerCase() !== key)].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(next);
  };
  const clearRecents = () => {
    setRecents([]);
    saveRecents([]);
  };

  const locateMe = async () => {
    if (!(await ensureLocation("Allow location to show properties around you."))) return;
    setIsLocating(true);
    setLocationError("");
    Keyboard.dismiss();
    try {
      const result = await fetchCurrentLocation();
      if (result && (result.fullAddress || result.exactLocation || result.city)) {
        remember({ full: result.fullAddress || result.exactLocation || result.city, city: result.city || "", title: result.locationTitle || result.city || "" });
        navigation.goBack();
      } else {
        setLocationError("Couldn't detect your address. Try searching instead.");
      }
    } catch (err) {
      setLocationError(err?.message || "Location access failed. Try searching instead.");
    } finally {
      setIsLocating(false);
    }
  };

  const pick = (full, c, title) => {
    Keyboard.dismiss();
    remember({ full, city: c, title });
    setLocation(full, c, title);
    navigation.goBack();
  };
  const pickPlace = (item) =>
    pick(item.fullAddress || [item.title, item.subtitle].filter(Boolean).join(", "), item.city || "", item.locality || item.title || "");
  const pickRecent = (r) => pick(r.full, r.city, r.title);
  const isCurrentRecent = (r) => exactLocation === r.full || fullAddress === r.full;
  const pickLocality = (item) =>
    pick(item.formatted || [item.locality, item.city].filter(Boolean).join(", "), item.city || item.locality, item.locality || item.city);

  const isSearchActive = query.length >= 2;
  const currentDisplay = locationTitle || exactLocation || city;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[brand.deep, brand.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.band, { paddingTop: insets.top + 6 }]}
        onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
        <FloatingPin />
        <Reveal distance={8} style={styles.headRow}>
          <PressableScale onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle} accessibilityRole="header">Choose location</Text>
            <View style={styles.currentRow}>
              <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.currentText} numberOfLines={1}>{currentDisplay ? currentDisplay : "All of India"}</Text>
            </View>
          </View>
        </Reveal>
        <Reveal delay={70} distance={10}>
          <SearchField
            inputRef={searchRef}
            value={searchQuery}
            searching={isSearching}
            onFocusChange={setSearchFocused}
            onChange={(t) => {
              setSearchQuery(t);
              if (locationError) setLocationError("");
            }}
          />
        </Reveal>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyInner, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Keyed by mode, so switching between browsing and searching crossfades. */}
        <Reveal key={isSearchActive ? "search" : "browse"} distance={10}>
          {isSearchActive ? (
            <SearchResults
              query={query}
              searching={isSearching}
              places={searchResults}
              localities={localityMatches}
              onPlace={pickPlace}
              onLocality={pickLocality}
            />
          ) : (
            <>
              <Reveal delay={90}>
                <GpsCard locating={isLocating} error={locationError} onPress={locateMe} />
              </Reveal>

              <Reveal delay={140}>
                <PressableScale to={0.98} onPress={() => pick("", "", "")} style={[styles.allCard, !currentDisplay && styles.cardOn]}
                  accessibilityRole="radio" accessibilityState={{ checked: !currentDisplay }} accessibilityLabel="All of India">
                  <View style={[styles.roundIcon, !currentDisplay && styles.roundIconOn]}>
                    <Ionicons name="earth" size={20} color={!currentDisplay ? colors.white : brand.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>All of India</Text>
                    <Text style={styles.cardSub}>Browse properties in every city</Text>
                  </View>
                  {!currentDisplay ? <CheckPop /> : <Ionicons name="chevron-forward" size={18} color={brand.inkSoft} />}
                </PressableScale>
              </Reveal>

              <Reveal delay={190}>
                <Text style={styles.section}>Popular cities</Text>
              </Reveal>
              <View style={styles.cityGrid}>
                {POPULAR_CITIES.map((metro, i) => (
                  <CityTile
                    key={metro}
                    name={metro}
                    delay={220 + i * 40}
                    on={currentDisplay === metro || city === metro}
                    onPress={() => pick(metro, metro, metro)}
                  />
                ))}
              </View>

              {recents?.length ? (
                <RecentList title="Recent" recents={recents} isCurrent={isCurrentRecent} onPick={pickRecent} onClear={clearRecents} delay={320} />
              ) : null}

              <Explore city={city} onPick={pickLocality} onSuggest={setSearchQuery} />
            </>
          )}
        </Reveal>
      </ScrollView>

      {/* Search box focused, nothing typed: a card of recent searches drops down over the screen,
          which stays visible (dimmed) behind; tapping it closes the card. */}
      {searchFocused && !isSearchActive && bandHeight ? (
        <>
          <Pressable style={[styles.backdrop, { top: bandHeight }]} onPress={() => searchRef.current?.blur()} accessibilityLabel="Close recent searches" />
          <PopIn style={[styles.dropdown, { top: bandHeight + 8 }]}>
            <ScrollView style={{ flexGrow: 0, maxHeight: Math.max(160, Math.min(380, height - bandHeight - keyboardHeight - 24)) }} contentContainerStyle={styles.dropdownInner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {recents?.length ? (
                <RecentList bare title="Recent searches" recents={recents} isCurrent={isCurrentRecent} onPick={pickRecent} onClear={clearRecents} />
              ) : (
                <>
                  <Text style={[styles.note, styles.dropdownNote]}>No recent searches yet.</Text>
                  <Explore onlyExamples onSuggest={setSearchQuery} />
                </>
              )}
            </ScrollView>
          </PopIn>
        </>
      ) : null}
    </View>
  );
}

// ----- Pieces ---------------------------------------------------------------------------------

// Search box on the header band. A soft white ring fades in around it while focused.
function SearchField({ inputRef, value, searching, onChange, onFocusChange }) {
  const focus = useRef(new Animated.Value(0)).current;
  const to = (v) => Animated.timing(focus, { toValue: v, duration: isReducedMotion() ? 0 : 180, useNativeDriver: true }).start();
  return (
    <View style={styles.searchWrap}>
      <Animated.View pointerEvents="none" style={[styles.searchRing, { opacity: focus, transform: [{ scale: focus.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]} />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={brand.violet} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search a road, area or city in India"
          placeholderTextColor={brand.placeholder}
          value={value}
          onChangeText={onChange}
          ref={inputRef}
          onFocus={() => { to(1); onFocusChange?.(true); }}
          onBlur={() => { to(0); onFocusChange?.(false); }}
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Search a road, area or city in India"
        />
        {searching ? (
          <ActivityIndicator size="small" color={brand.violet} />
        ) : value ? (
          <Pressable onPress={() => onChange("")} hitSlop={10} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={brand.placeholder} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Large faint pin drifting in the band's corner.
function FloatingPin() {
  const float = useFloat(7, 3200);
  return (
    <Animated.View pointerEvents="none" style={[styles.bandPin, isReducedMotion() ? null : float]}>
      <Ionicons name="location" size={92} color="rgba(255,255,255,0.10)" />
    </Animated.View>
  );
}

// "Use my current location": the arrow swings like a compass needle, and spins while locating.
function GpsCard({ locating, error, onPress }) {
  return (
    <PressableScale to={0.98} onPress={onPress} disabled={locating} style={styles.gpsCard} accessibilityRole="button"
      accessibilityLabel="Use my current location" accessibilityState={{ busy: locating }}>
      <Radar fast={locating} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>Use my current location</Text>
        <Text style={[styles.cardSub, error ? styles.errorText : null]} numberOfLines={2}>
          {locating ? "Finding you…" : error || "Detect your locality with GPS"}
        </Text>
      </View>
      {locating ? <ActivityIndicator size="small" color={brand.violet} /> : <Ionicons name="chevron-forward" size={18} color={brand.inkSoft} />}
    </PressableScale>
  );
}

// Compass: at rest the arrow sways ±14° and settles, like a needle finding north, with a soft halo
// breathing behind it; while locating it spins steadily.
function Radar({ fast }) {
  const needle = useRef(new Animated.Value(0)).current; // degrees
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReducedMotion()) return undefined;
    needle.setValue(0);
    const sway = (to, duration) => Animated.timing(needle, { toValue: to, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const spin = Animated.loop(Animated.timing(needle, { toValue: 360, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    const swing = Animated.loop(Animated.sequence([sway(-14, 420), sway(10, 520), sway(-5, 420), sway(0, 380), Animated.delay(1600)]));
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const run = fast ? spin : swing;
    run.start();
    breathe.start();
    return () => { run.stop(); breathe.stop(); };
  }, [fast, needle, halo]);
  return (
    <View style={styles.radar}>
      <Animated.View
        pointerEvents="none"
        style={[styles.radarRing, {
          opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] }),
          transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
        }]}
      />
      <View style={styles.radarCore}>
        <Animated.View style={{ transform: [{ rotate: needle.interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] }) }] }}>
          <Ionicons name="navigate" size={20} color={brand.violet} />
        </Animated.View>
      </View>
    </View>
  );
}

// Fades and springs up from slightly smaller; `delay` staggers a group.
function PopIn({ delay = 0, style, children }) {
  const v = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (isReducedMotion()) return;
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true }),
    ]).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Selected tick that springs in.
function CheckPop({ size = 24 }) {
  return (
    <PopIn style={[styles.check, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="checkmark" size={size * 0.6} color={colors.white} />
    </PopIn>
  );
}

// Line-art monument with the city name below. The picked city is drawn in violet with a lavender
// fill (arches left white) and a bold name.
function CityTile({ name, on, delay, onPress }) {
  return (
    <PopIn delay={delay} style={styles.cityCell}>
      <PressableScale to={0.92} onPress={onPress} style={styles.cityTile} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={name}>
        <CityLandmark
          city={name}
          size={54}
          stroke={on ? brand.violet : "#5B5670"}
          fill={on ? brand.lavenderMid : "none"}
          hole={on ? colors.white : "none"}
          strokeWidth={on ? 1.7 : 1.5}
        />
        <Text style={[styles.cityName, on && styles.cityNameOn]} numberOfLines={1}>{name}</Text>
      </PressableScale>
    </PopIn>
  );
}

function LocalityRow({ title, sub, icon, on, first, match, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, on && styles.rowOn, pressed && { backgroundColor: brand.lavender }]}
      accessibilityRole="button" accessibilityState={{ selected: !!on }} accessibilityLabel={sub ? `${title}, ${sub}` : title}>
      <View style={[styles.rowIcon, on && styles.roundIconOn]}>
        <Ionicons name={icon} size={16} color={on ? colors.white : brand.violet} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, on && { color: brand.deep }]} numberOfLines={1}><Highlighted text={title} match={match} /></Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {on ? <CheckPop size={22} /> : <Ionicons name="arrow-forward" size={15} color={brand.placeholder} />}
    </Pressable>
  );
}

// The searched text, bolded where it appears.
function Highlighted({ text, match }) {
  const at = match ? String(text).toLowerCase().indexOf(match.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <Text style={styles.hit}>{text.slice(at, at + match.length)}</Text>
      {text.slice(at + match.length)}
    </>
  );
}

function SearchResults({ query, searching, places, localities, onPlace, onLocality }) {
  const nothing = !searching && !places.length && !localities.length;
  return (
    <View>
      {localities.length ? (
        <>
          <Text style={styles.section}>Localities with listings</Text>
          <View style={styles.listCard}>
            {localities.map((l, i) => (
              <Reveal key={`${l.city}|${l.locality}|${i}`} delay={stagger(i, 40)} distance={8}>
                <LocalityRow title={l.locality || l.city} sub={l.locality && l.city ? l.city : ""} icon="business" first={i === 0} match={query} onPress={() => onLocality(l)} />
              </Reveal>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Places in India</Text>
      {searching && !places.length ? (
        <SkeletonRows count={4} />
      ) : places.length ? (
        <View style={[styles.listCard, searching && { opacity: 0.6 }]}>
          {places.map((p, i) => (
            <Reveal key={p.id || `place-${i}`} delay={stagger(i, 45)} distance={8}>
              <LocalityRow title={p.title} sub={p.subtitle} icon="location" first={i === 0} match={query} onPress={() => onPlace(p)} />
            </Reveal>
          ))}
        </View>
      ) : nothing ? (
        <EmptyState query={query} />
      ) : (
        <Text style={styles.note}>No other places match "{query}".</Text>
      )}
    </View>
  );
}

// Example searches; tapping one types it into the search box.
const SEARCH_EXAMPLES = ["Andheri West", "Whitefield", "Hinjewadi", "Gachibowli", "Powai", "Salt Lake", "Golf Course Road", "Sector 62"];

// Under the popular cities: Trending (localities with the most listings), Nearby (other
// localities in the current city; hidden for All of India) and Try searching (examples).
// `onlyExamples` (the focused, empty search box) shows just the example searches.
function Explore({ city, onPick, onSuggest, onlyExamples }) {
  const [trending, setTrending] = useState(null);
  const [nearby, setNearby] = useState(null);
  useEffect(() => {
    if (onlyExamples) return undefined;
    let alive = true;
    api.locations({ limit: 12 })
      .then((r) => alive && setTrending((r?.locations || []).filter((l) => l.locality).slice(0, 6)))
      .catch(() => alive && setTrending([]));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    setNearby(null);
    if (!city || onlyExamples) return undefined;
    api.locations({ city, limit: 10 })
      .then((r) => alive && setNearby((r?.locations || []).filter((l) => l.locality).slice(0, 8)))
      .catch(() => alive && setNearby([]));
    return () => { alive = false; };
  }, [city]);

  return (
    <>
      {trending?.length ? (
        <ChipSection title="Trending" icon="trending-up" delay={360}
          items={trending.map((l) => ({ key: `${l.locality}|${l.city}`, label: l.locality, sub: l.city, onPress: () => onPick(l) }))} />
      ) : null}
      {nearby?.length ? (
        <ChipSection title={`Nearby in ${city}`} icon="location-outline" delay={420}
          items={nearby.map((l) => ({ key: `${l.locality}|${l.city}`, label: l.locality, onPress: () => onPick(l) }))} />
      ) : null}
      <ChipSection title="Try searching" icon="search" delay={onlyExamples ? 60 : 480}
        items={SEARCH_EXAMPLES.map((q) => ({ key: q, label: q, onPress: () => onSuggest(q) }))} />
    </>
  );
}

// Recently picked locations with a Clear link; used on the main view and (`bare`, already inside a
// card) in the dropdown under the focused search box.
function RecentList({ title, recents, isCurrent, onPick, onClear, delay = 0, bare }) {
  return (
    <>
      <Reveal delay={delay} style={[styles.sectionRow, bare && styles.bareHead]}>
        <Text style={[styles.section, { flex: 1 }, bare && styles.bareSection]}>{title}</Text>
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear recent locations">
          <Text style={[styles.clearText, bare && { marginTop: 0 }]}>Clear</Text>
        </Pressable>
      </Reveal>
      <View style={bare ? null : styles.listCard}>
        {recents.map((r, i) => (
          <Reveal key={r.full || r.city} delay={delay + 20 + stagger(i, 45)} distance={10}>
            <LocalityRow
              title={r.title || r.city || r.full}
              sub={r.full && r.full !== (r.title || r.city) ? r.full : r.city && r.city !== r.title ? r.city : ""}
              icon="time-outline"
              on={isCurrent(r)}
              first={i === 0}
              onPress={() => onPick(r)}
            />
          </Reveal>
        ))}
      </View>
    </>
  );
}

function ChipSection({ title, icon, items, delay }) {
  return (
    <View>
      <Reveal delay={delay}>
        <Text style={styles.section}>{title}</Text>
      </Reveal>
      <View style={styles.chips}>
        {items.map((it, i) => (
          <PopIn key={it.key} delay={delay + 30 + Math.min(i, 8) * 35}>
            <PressableScale to={0.94} onPress={it.onPress} style={styles.chip} accessibilityRole="button" accessibilityLabel={it.sub ? `${it.label}, ${it.sub}` : it.label}>
              <Ionicons name={icon} size={14} color={brand.violet} />
              <Text style={styles.chipText} numberOfLines={1}>{it.label}</Text>
              {it.sub ? <Text style={styles.chipSub} numberOfLines={1}>· {it.sub}</Text> : null}
            </PressableScale>
          </PopIn>
        ))}
      </View>
    </View>
  );
}

function EmptyState({ query }) {
  const float = useFloat(6, 2600);
  return (
    <Reveal style={styles.empty}>
      <Animated.View style={[styles.emptyIcon, isReducedMotion() ? null : float]}>
        <Ionicons name="location-outline" size={30} color={brand.violet} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No places found for "{query}"</Text>
      <Text style={styles.emptySub}>Try a road, locality, landmark, city or state.</Text>
    </Reveal>
  );
}

// Placeholder rows that shimmer while results load.
function SkeletonRows({ count }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReducedMotion()) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <View style={styles.listCard} accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.row, i > 0 && styles.rowLine, { opacity }]}>
          <View style={[styles.rowIcon, styles.skel]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.skel, styles.skelLine, { width: `${70 - (i % 3) * 12}%` }]} />
            <View style={[styles.skel, styles.skelLine, { width: "38%", height: 9 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  band: { paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, overflow: "hidden" },
  bandPin: { position: "absolute", right: -8, top: 18 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  headTitle: { fontSize: 21, fontWeight: "800", color: colors.white },
  currentRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  currentText: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.85)" },

  searchWrap: { justifyContent: "center" },
  searchRing: { position: "absolute", top: -4, bottom: -4, left: -4, right: -4, borderRadius: radius.md + 4, backgroundColor: "rgba(255,255,255,0.28)" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.white },
  searchInput: { flex: 1, fontSize: 14.5, color: brand.ink, paddingVertical: 8 },
  clearBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 16, paddingTop: 16 },
  section: { fontSize: 12, fontWeight: "800", color: brand.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 22, marginBottom: 10 },
  note: { fontSize: 13, color: brand.inkSoft, marginVertical: 8 },
  errorText: { color: colors.error },

  // GPS and All of India: soft lavender cards with a white icon disc.
  gpsCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: brand.lavender, borderWidth: 1.2, borderColor: brand.lavenderMid },
  radar: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  radarRing: { position: "absolute", width: 48, height: 48, borderRadius: 24, backgroundColor: brand.violet },
  radarCore: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },

  allCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginTop: 12, borderRadius: radius.lg, backgroundColor: brand.lavender, borderWidth: 1.2, borderColor: brand.lavenderMid },
  cardOn: { borderColor: brand.violet },
  roundIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  roundIconOn: { backgroundColor: brand.violet },
  cardTitle: { fontSize: 15, fontWeight: "800", color: brand.ink },
  cardSub: { fontSize: 12.5, color: brand.inkSoft, marginTop: 2 },
  check: { alignItems: "center", justifyContent: "center", backgroundColor: brand.violet },

  // Four cities per row.
  cityGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  cityCell: { width: "25%", paddingHorizontal: 4, paddingVertical: 6 },
  cityTile: { alignItems: "center", gap: 6, paddingVertical: 4 },
  cityName: { fontSize: 12.5, fontWeight: "600", color: brand.inkSoft, textAlign: "center", alignSelf: "stretch" },
  cityNameOn: { color: brand.violet, fontWeight: "800" },

  listCard: { borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: brand.lavenderMid, overflow: "hidden", ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: "#F1ECFA" },
  rowOn: { backgroundColor: "#FBF8FF" },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: brand.lavender },
  rowTitle: { fontSize: 14.5, fontWeight: "600", color: brand.ink },
  rowSub: { fontSize: 12.5, color: brand.inkSoft, marginTop: 2, lineHeight: 17 },
  hit: { fontWeight: "800", color: brand.deep },

  sectionRow: { flexDirection: "row", alignItems: "center" },
  clearText: { fontSize: 13, fontWeight: "800", color: brand.violet, marginTop: 12 },
  backdrop: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(20, 12, 40, 0.18)" },
  dropdown: { position: "absolute", left: 16, right: 16, borderRadius: radius.lg, backgroundColor: colors.white, ...shadow.float },
  dropdownInner: { paddingHorizontal: 6, paddingTop: 4, paddingBottom: 10 },
  dropdownNote: { marginHorizontal: 10, marginTop: 12 },
  bareHead: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 2 },
  bareSection: { marginTop: 0, marginBottom: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38, maxWidth: "100%", paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1.2, borderColor: brand.lavenderMid },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: brand.ink },
  chipSub: { fontSize: 12, fontWeight: "600", color: brand.inkSoft },

  skel: { backgroundColor: "#EEE8FA" },
  skelLine: { height: 12, borderRadius: 6 },

  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: brand.lavender, marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: brand.ink, textAlign: "center" },
  emptySub: { fontSize: 12.5, color: brand.inkSoft, textAlign: "center", lineHeight: 18 },
});
