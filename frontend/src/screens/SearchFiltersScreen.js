import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSpace } from "../hooks/useBottomSpace";
import Button from "../components/Button";
import PressableScale from "../components/PressableScale";
import RollingPlaceholder from "../components/RollingPlaceholder";
import SearchTabs from "../components/search/SearchTabs";
import FilterSidebar from "../components/search/FilterSidebar";
import FilterContent from "../components/search/FilterContent";
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
// The three tabs on top. A search opened in another context (Commercial, Plots) gets its own tab.
const MAIN_TABS = ["buy_residential", "rent_residential", "new_projects"];
const TAB_LABELS = { rent_residential: "Rent" };
const hasAny = (p) => Object.entries(p || {}).some(([k, v]) => !k.startsWith("_") && k !== "returnTo" && v !== "" && v != null && v !== false);

// The search form: Buy / Rent / Projects tabs, a search field, and a sidebar of filter categories
// whose controls open in the main area - all driven by the filter config (filters.json `sidebar`).
// Each tab keeps its own filters while the screen is open; location and search text are shared.
// Everything is a draft until "Apply Filters" - back discards it.
// Opened from Home (new search) or from the results screen (refine, `returnTo`).
export default function SearchFiltersScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bottom, tabBar, inset } = useBottomSpace();
  const { width } = useWindowDimensions();
  const params = route.params || {};
  const [draft, setDraft] = useState(() => fromQueryParams(params, config, DEFAULT_CONTEXT));
  const [ready, setReady] = useState(!!params.context);
  const [categoryId, setCategoryId] = useState(null);
  const stash = useRef({}); // per-tab filters left behind when switching tabs
  const contentRef = useRef(null);

  // No explicit context: open on the last used one (or the onboarding intent) with its saved filters.
  useEffect(() => {
    if (params.context) return;
    let alive = true;
    (async () => {
      const { last, intent } = await loadDefaultContext();
      const ctx = [last, INTENT_CONTEXT[intent], DEFAULT_CONTEXT].find((c) => c && getContext(config, c)?.id === c);
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

  const tabs = [...MAIN_TABS, ...(MAIN_TABS.includes(draft.context) ? [] : [draft.context])]
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

  const submit = () => {
    const p = { ...queryParams, _applied: Date.now() };
    if (params.returnTo === "Search") navigation.popTo("Search", p);
    // As the Search tab's first screen it stays underneath the results; elsewhere it is swapped out.
    else if ((navigation.getState()?.index ?? 0) === 0) navigation.navigate("Search", p);
    else navigation.replace("Search", p);
  };

  const sidebarWidth = Math.round(Math.min(220, Math.max(132, width * 0.35)));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <LinearGradient colors={[brand.deep, brand.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.band, { paddingTop: insets.top + 6 }]}>
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
        <View style={styles.headBody}>
          <SearchTabs tabs={tabs} value={draft.context} onChange={switchTab} />
          <SearchField value={draft.query.search} onChange={(search) => setDraft((d) => setQuery(d, config, { search }))} />
        </View>
      </LinearGradient>

      {!ready ? (
        <ActivityIndicator color={brand.violet} style={{ marginTop: 40, flex: 1 }} />
      ) : (
        <View style={styles.split}>
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

      {/* Runs on behind the floating tab bar, so there's no dead strip or hard edge between the two. */}
      <View style={[styles.footer, { paddingBottom: tabBar ? tabBar + 10 : Math.max(inset, 10) + 6 }]}>
        <Text style={styles.match} accessibilityLiveRegion="polite">
          {live.error ? " " : live.loading || live.count == null ? "Counting matches…" : `${live.count.toLocaleString("en-IN")} ${live.count === 1 ? "property matches" : "properties match"}`}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => setDraft((d) => clearEverything(d, config))}
            disabled={!selected}
            style={({ pressed }) => [styles.clearAll, !selected && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            accessibilityState={{ disabled: !selected }}
          >
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button small title="Apply Filters" onPress={submit} disabled={!ready} accessibilityHint="Shows the properties that match" />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Free-text search across city, locality, project and developer. Local text so FilterState's
// trimming never eats a space while typing.
function SearchField({ value, onChange }) {
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
      <Ionicons name="search" size={18} color={colors.muted} />
      <View style={styles.searchBox}>
        {/* Rolling examples stand in for the placeholder until the user types. */}
        {text ? null : <RollingPlaceholder style={StyleSheet.absoluteFill} />}
        <TextInput
          value={text}
          onChangeText={set}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  band: { paddingBottom: 16, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 52 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.white, marginLeft: 6 },
  headBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.18)", marginRight: 6 },
  headBadgeText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  headBody: { paddingHorizontal: 16, gap: 12, marginTop: 4 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  searchBox: { flex: 1, justifyContent: "center" },
  // No horizontal padding, so typed text starts exactly where the rolling hint does.
  searchInput: { fontSize: 14.5, color: colors.ink, paddingVertical: 10, paddingHorizontal: 0 },
  searchClear: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  // Lavender behind both columns; the white content panel is a rounded card beside the sidebar.
  split: { flex: 1, flexDirection: "row", backgroundColor: brand.lavender, paddingTop: 10 },
  content: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  contentInner: { padding: 16, paddingBottom: 28 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.float,
  },
  match: { textAlign: "center", fontSize: 12.5, color: colors.muted, fontWeight: "600", marginBottom: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  clearAll: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1.4,
    borderColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  clearAllText: { fontSize: 14, fontWeight: "800", color: brand.violet },
});
