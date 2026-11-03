import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { resultsLabel } from "../components/filters/ApplyBar";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSpace } from "../hooks/useBottomSpace";
import Button from "../components/Button";
import PressableScale from "../components/PressableScale";
import Reveal from "../components/Reveal";
import RollingPlaceholder from "../components/RollingPlaceholder";
import SearchTabs from "../components/search/SearchTabs";
import FilterSidebar from "../components/search/FilterSidebar";
import FilterContent from "../components/search/FilterContent";
import SearchSuggestions from "../components/search/SearchSuggestions";
import { filterConfig } from "../hooks/useFilterState";
import { useLiveCount } from "../hooks/useLiveCount";
import { loadDefaultContext, loadFilters } from "../services/filterStorage";
import { getContext } from "../utils/filterConfig";
import {
  INTENT_CONTEXT,
  activeFilterIds,
  categoryCount,
  clearCategory,
  clearEverything,
  createFilterState,
  fromQueryParams,
  setQuery,
  setValue,
  toQueryParams,
} from "../utils/filterState";
import { brand, colors, radius, shadow } from "../theme";
import Text, { AppTextInput as TextInput } from "../components/AppText";

const config = filterConfig;
const DEFAULT_CONTEXT = "buy_residential";
// The three tabs on top.
const MAIN_TABS = ["buy_residential", "rent_residential", "new_projects"];
const TAB_LABELS = { rent_residential: "Rent" };
// Only Buy / Rent / Projects are offered here; any other context (commercial, plots - from the
// onboarding intent, last use or a caller) opens on Buy instead of adding a fourth tab.
const mainContext = (c) => (MAIN_TABS.includes(c) ? c : DEFAULT_CONTEXT);
const hasAny = (p) => Object.entries(p || {}).some(([k, v]) => !k.startsWith("_") && k !== "returnTo" && v !== "" && v != null && v !== false);

// The search form: Buy / Rent / Projects tabs, a search field, and a sidebar of filter categories
// whose controls open in the main area - all driven by the filter config (filters.json `sidebar`).
// Each tab keeps its own filters while the screen is open; location and search text are shared.
// Everything is a draft until "Apply Filters" - back discards it.
// Opened from Home (new search) or from the results screen (refine, `returnTo`).
export default function SearchFiltersScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bottom, tabBar, inset } = useBottomSpace();
  const { width, height } = useWindowDimensions();
  const rawParams = route.params || {};
  const params = rawParams.context ? { ...rawParams, context: mainContext(rawParams.context) } : rawParams;
  const [draft, setDraft] = useState(() => fromQueryParams(params, config, DEFAULT_CONTEXT));
  const [ready, setReady] = useState(!!params.context);
  const [categoryId, setCategoryId] = useState(null);
  const stash = useRef({}); // per-tab filters left behind when switching tabs
  const contentRef = useRef(null);
  const searchRef = useRef(null);
  // Suggestions drop down under the header while the search field is focused.
  const [suggesting, setSuggesting] = useState(false);
  const [bandHeight, setBandHeight] = useState(0);
  // The floating tab bar unmounts while the keyboard is up (see BottomNav), so its height must not
  // be reserved then - otherwise the footer's dead space hides the list being typed into.
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardUp(true);
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    // Android's back button hides the keyboard without blurring the field; treat it as done.
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardUp(false);
      setKeyboardHeight(0);
      searchRef.current?.blur();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // No explicit context: open on the last used one (or the onboarding intent) with its saved filters.
  useEffect(() => {
    if (params.context) return;
    let alive = true;
    (async () => {
      const { last, intent } = await loadDefaultContext();
      const ctx = [last, INTENT_CONTEXT[intent], DEFAULT_CONTEXT].find((c) => MAIN_TABS.includes(c) && getContext(config, c)?.id === c);
      const saved = hasAny(params) ? null : await loadFilters(ctx);
      if (alive) {
        setDraft(fromQueryParams({ ...(saved || {}), ...params, context: ctx }, config, ctx));
        setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = getContext(config, draft.context);
  const sidebar = ctx?.sidebar || [];
  const category = sidebar.find((c) => c.id === categoryId) || sidebar[0];
  const categoryFilters = (category?.filters || []).map((id) => ctx.filters.find((f) => f.id === id)).filter(Boolean);
  const counts = Object.fromEntries(sidebar.map((c) => [c.id, categoryCount(draft, c)]));
  const selected = activeFilterIds(draft, config).length + ["search", "city", "locality"].filter((k) => draft.query[k]).length;
  // The Clear / Apply footer only appears once something is selected.
  const showFooter = ready && selected > 0 && !suggesting;
  const footerPad = keyboardUp ? 10 : tabBar ? tabBar + 8 : Math.max(inset, 10) + 4;

  const tabs = MAIN_TABS
    .filter((id) => config.contexts[id])
    .map((id) => ({ id, label: TAB_LABELS[id] || config.contexts[id].label, icon: config.contexts[id].icon }));

  const queryParams = useMemo(() => toQueryParams(draft, config), [draft]);
  const live = useLiveCount(queryParams, { enabled: ready });

  const switchTab = (id) => {
    if (id === draft.context) return;
    stash.current[draft.context] = { values: draft.values, developer: draft.query.developer, project: draft.query.project };
    const s = stash.current[id] || { values: {}, developer: "", project: "" };
    setDraft(createFilterState(config, id, { query: { ...draft.query, developer: s.developer, project: s.project }, values: s.values }));
    // Stay on the same category when the new tab has it (e.g. BHK -> BHK), else start at the top.
    const next = getContext(config, id)?.sidebar || [];
    if (!next.some((c) => c.id === category?.id)) setCategoryId(next[0]?.id || null);
    contentRef.current?.scrollTo({ y: 0, animated: false });
  };

  const selectCategory = (id) => {
    setCategoryId(id);
    contentRef.current?.scrollTo({ y: 0, animated: false });
  };

  // `state` lets a suggestion submit the draft it just built, before React re-renders with it.
  const submit = (state = draft) => {
    if (!ready) return;
    const p = { ...(state === draft ? queryParams : toQueryParams(state, config)), _applied: Date.now() };
    if (params.returnTo === "Search") navigation.popTo("Search", p);
    // As the Search tab's first screen it stays underneath the results; elsewhere it is swapped out.
    else if ((navigation.getState()?.index ?? 0) === 0) navigation.navigate("Search", p);
    else navigation.replace("Search", p);
  };

  const closeSuggestions = () => {
    searchRef.current?.blur();
    Keyboard.dismiss();
  };
  // Fits between the header and the keyboard, and never grows past a compact card.
  const dropdownMax = Math.max(160, Math.min(360, height - bandHeight - keyboardHeight - 24));
  // Picking a suggestion applies it and opens the results, like the keyboard's search key.
  const applyNow = (next) => {
    setDraft(next);
    closeSuggestions();
    submit(next);
  };
  // A picked suggestion becomes a real filter and replaces the typed text.
  const pickSuggestion = (patch) => applyNow(setQuery(draft, config, { search: "", ...patch }));
  // A recent search restores its text, location and BHK; its type label only when it still names
  // a type option here (otherwise it would become a free-text type that matches nothing).
  const pickRecent = (it) => {
    const p = toQueryParams(draft, config);
    const next = fromQueryParams({ ...p, search: it.query || "", city: it.city || "", locality: it.locality || "", bhk: it.bhk || p.bhk, propertyType: it.propertyType || "" }, config, draft.context);
    applyNow(next.query.propertyType ? setQuery(next, config, { propertyType: "" }) : next);
  };

  const sidebarWidth = Math.round(Math.min(220, Math.max(132, width * 0.35)));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[brand.deep, brand.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.band, { paddingTop: insets.top + 6 }]}
        onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.headRow}>
          {/* No back arrow when this is the Search tab's own first screen. */}
          {(navigation.getState()?.index ?? 0) > 0 ? (
            <PressableScale onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back" accessibilityHint="Discards changes">
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </PressableScale>
          ) : null}
          <Text style={styles.headTitle} accessibilityRole="header">
            Search & Filters
          </Text>
          {selected ? (
            <View style={styles.headBadge}>
              <Text style={styles.headBadgeText}>{selected} selected</Text>
            </View>
          ) : null}
        </View>
        <Reveal delay={60} distance={10} style={styles.headBody}>
          <SearchTabs tabs={tabs} value={draft.context} onChange={switchTab} />
          <SearchField
            inputRef={searchRef}
            value={draft.query.search}
            onChange={(search) => setDraft((d) => setQuery(d, config, { search }))}
            onFocus={() => setSuggesting(true)}
            onBlur={() => setSuggesting(false)}
            onSubmit={() => submit()}
          />
          <PickedChips query={draft.query} onClear={(key) => setDraft((d) => setQuery(d, config, { [key]: "" }))} />
        </Reveal>
      </LinearGradient>

      {!ready ? (
        <ActivityIndicator color={brand.violet} style={{ marginTop: 40, flex: 1 }} />
      ) : (
        // The white panel ends above the footer / tab bar with a lavender gap, so its rounded
        // bottom corner is always fully visible instead of running under them.
        <View style={[styles.split, { paddingBottom: showFooter ? 10 : footerPad + 10 }]}>
          <FilterSidebar
            categories={sidebar}
            value={category?.id}
            counts={counts}
            onSelect={selectCategory}
            width={sidebarWidth}
            animKey={draft.context}
          />
          <ScrollView
            ref={contentRef}
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <FilterContent
              category={category}
              filters={categoryFilters}
              draft={draft}
              count={category ? counts[category.id] : 0}
              transitionKey={`${draft.context}:${category?.id}`}
              onValue={(id, v) => setDraft((d) => setValue(d, config, id, v))}
              onQuery={(patch) => setDraft((d) => setQuery(d, config, patch))}
              onClear={() => setDraft((d) => clearCategory(d, config, category))}
            />
          </ScrollView>
        </View>
      )}

      {/* Suggestions drop down over the filters, which stay visible (dimmed) behind; tapping
          them closes the dropdown. */}
      {suggesting && bandHeight ? (
        <>
          <Pressable style={[styles.backdrop, { top: bandHeight }]} onPress={closeSuggestions} accessibilityLabel="Close suggestions" />
          <View style={[styles.dropdown, { top: bandHeight + 6 }]}>
            <DropdownScroll maxHeight={dropdownMax}>
              <SearchSuggestions
                text={draft.query.search}
                context={draft.context}
                onSearchText={() => applyNow(draft)}
                onPickRecent={pickRecent}
                onPickLocation={pickSuggestion}
                onPickProject={(project) => pickSuggestion({ project })}
                onPickDeveloper={(developer) => pickSuggestion({ developer })}
              />
            </DropdownScroll>
          </View>
        </>
      ) : null}

      {/* Runs on behind the floating tab bar, so there's no dead strip or hard edge between the two.
          Mounted only while filters are selected, so it slides up on the first pick. */}
      {showFooter ? (
        <Reveal delay={0} distance={28} style={[styles.footer, { paddingBottom: footerPad }]}>
          {/* One compact row: the live match count rides in the Apply button, so the footer takes
              a single button's height and leaves the rest of the screen to the filters. */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => setDraft((d) => clearEverything(d, config))}
              disabled={!selected}
              style={({ pressed }) => [styles.clearAll, !selected && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              accessibilityState={{ disabled: !selected }}
            >
              <Ionicons name="refresh" size={16} color={brand.violet} />
              <Text style={styles.clearAllText}>Clear</Text>
            </Pressable>
            <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
              <Button
                small
                title={resultsLabel(live)}
                onPress={() => submit()}
                disabled={!ready}
                accessibilityLabel={live.loading || live.count == null ? "Apply filters, counting matches" : `Apply filters, ${resultsLabel(live)}`}
                accessibilityHint="Shows the properties that match"
              />
            </View>
          </View>
        </Reveal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// Free-text search across city, locality, project and developer. Local text so FilterState's
// trimming never eats a space while typing.
function SearchField({ inputRef, value, onChange, onFocus, onBlur, onSubmit }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (value !== text.trim()) setText(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (v) => {
    setText(v);
    onChange(v);
  };
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={colors.muted} />
      <View style={styles.searchBox}>
        {/* Rolling examples stand in for the placeholder until the user types. */}
        {text ? null : <RollingPlaceholder style={StyleSheet.absoluteFill} />}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={set}
          onFocus={onFocus}
          onBlur={onBlur}
          // The keyboard's search key applies the search, like the Apply button.
          onSubmitEditing={onSubmit}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search by city, locality, project or developer"
        />
      </View>
      {text ? (
        <Pressable onPress={() => set("")} hitSlop={10} style={styles.searchClear} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// The suggestions list with its own scroll bar: the native one can't be styled, and on Android it
// runs square along the card's edge over the rows. This one is a rounded thumb in a slim track,
// inset from the card's corners, beside (not over) the rows. Shown only when the list overflows.
const BAR_INSET = 10;
function DropdownScroll({ maxHeight, children }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const scrollable = box > 0 && content > box + 1;
  const track = Math.max(0, box - BAR_INSET * 2);
  const thumb = scrollable ? Math.max(32, (track * box) / content) : 0;
  const translateY = scrollable
    ? scrollY.interpolate({ inputRange: [0, content - box], outputRange: [0, track - thumb], extrapolate: "clamp" })
    : 0;
  return (
    <View>
      <Animated.ScrollView
        style={{ flexGrow: 0, maxHeight }}
        contentContainerStyle={styles.dropdownInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setBox(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContent(h)}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {children}
      </Animated.ScrollView>
      {scrollable ? (
        <View pointerEvents="none" style={[styles.barTrack, { height: track }]}>
          <Animated.View style={[styles.barThumb, { height: thumb, transform: [{ translateY }] }]} />
        </View>
      ) : null}
    </View>
  );
}

// Project / developer picked from a suggestion. Buy and Rent have no panel for them, so they're
// shown (and removable) here.
function PickedChips({ query, onClear }) {
  const chips = [
    query.project && { key: "project", icon: "business-outline", label: query.project },
    query.developer && { key: "developer", icon: "construct-outline", label: query.developer },
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <View style={styles.chips}>
      {chips.map((c) => (
        <Pressable key={c.key} onPress={() => onClear(c.key)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Remove ${c.key} ${c.label}`}>
          <Ionicons name={c.icon} size={13} color={colors.white} />
          <Text style={styles.chipText} numberOfLines={1}>{c.label}</Text>
          <Ionicons name="close" size={14} color={colors.white} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{ flex: 1, backgroundColor: brand.bg },
  band: { paddingBottom: 12, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 52 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.white, marginLeft: 6 },
  headBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.18)", marginRight: 6 },
  headBadgeText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  headBody: { paddingHorizontal: 16, gap: 10, marginTop: 2 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  searchBox: { flex: 1, justifyContent: "center" },
  // No horizontal padding, so typed text starts exactly where the rolling hint does.
  searchInput: { fontSize: 14.5, color: colors.ink, paddingVertical: 6, paddingHorizontal: 0 },
  searchClear: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, maxWidth: "100%", paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.18)" },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: colors.white },
  // Lavender behind both columns; the white content panel is a rounded card beside the sidebar.
  split: { flex: 1, flexDirection: "row", backgroundColor: brand.lavender, paddingTop: 10 },
  content: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  backdrop: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(20, 12, 40, 0.18)" },
  dropdown: { position: "absolute", left: 16, right: 16, borderRadius: radius.md, backgroundColor: colors.white, ...shadow.float },
  // Right padding keeps the rows clear of the scroll bar.
  dropdownInner: { paddingLeft: 8, paddingRight: 18, paddingVertical: 4 },
  barTrack: { position: "absolute", top: BAR_INSET, right: 6, width: 5, borderRadius: 3, backgroundColor: brand.lavender },
  barThumb: { width: 5, borderRadius: 3, backgroundColor: brand.violet, opacity: 0.55 },
  contentInner: { padding: 16, paddingBottom: 28 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.float,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  clearAll: {
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.4,
    borderColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  clearAllText: { fontSize: 14, fontWeight: "800", color: brand.violet },
});
