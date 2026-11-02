import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useBottomSpace } from "../hooks/useBottomSpace";
import FilterChip from "../components/FilterChip";
import PropertyCard from "../components/PropertyCard";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import CountUp from "../components/CountUp";
import Reveal from "../components/Reveal";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import QuickFilterBar from "../components/filters/QuickFilterBar";
import QuickFilterSheet from "../components/filters/QuickFilterSheet";
import ContextTabs from "../components/search/ContextTabs";
import { api } from "../services/api";
import PressableScale from "../components/PressableScale";
import { brand, colors, radius, shadow } from "../theme";
import { addSearchHistory } from "../services/historyService";
import { useFilterState } from "../hooks/useFilterState";
import { useRemovalCounts } from "../hooks/useLiveCount";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { contextIds, getContext, getFilter } from "../utils/filterConfig";
import { chipLabel, fromQueryParams, toQueryParams, withoutEach } from "../utils/filterState";
import Text, { AppTextInput as TextInput } from "../components/AppText";

const PAGE_SIZE = 12;
const MAX_SUGGESTIONS = 4;
const TOP_BUTTON_AFTER = 700; // px scrolled before "back to top" appears

// Results for a search. Same violet header band as the Search & Filters form it comes from, so the
// two read as one flow: back, title + location, search field, then the listing-type tabs.
// Opened from Home's "Resume Search" with `_resumed`, it greets the user with a resume banner
// until they change the search.
export default function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bottom } = useBottomSpace();
  const init = route.params || {};
  const filters = useFilterState(init);
  const { state: fs, config, params, ready, activeCount } = filters;
  const ctx = getContext(config, fs.context);
  const canPop = (navigation.getState()?.index ?? 0) > 0;

  const [text, setText] = useState(init.search || "");
  const [quickFor, setQuickFor] = useState(null);
  const [sortSheet, setSortSheet] = useState(false);
  const [resumed, setResumed] = useState(!!init._resumed);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [st, setSt] = useState({ loading: true, more: false, error: null });
  // Bumped on every fresh page 1, remounting the list so the cards replay their entrance.
  const [generation, setGeneration] = useState(0);
  const inflight = useRef(null);
  const listRef = useRef(null);

  // The restored state may carry a search term (deep link); show it in the box.
  useEffect(() => {
    if (ready) setText(fs.query.search);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => {
      if (text.trim() !== fs.query.search) filters.setQuery({ search: text.trim() });
    }, 400);
    return () => clearTimeout(t);
  }, [text, ready]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce typing only

  // Coming back from the filter form with a new search (`_applied` changes each time).
  const applied = route.params?._applied;
  useEffect(() => {
    if (!applied || !ready) return;
    const next = fromQueryParams(route.params, config, fs.context);
    if (filters.isSame(next)) return; // first mount already started from these params
    filters.replace(next);
    setText(next.query.search);
  }, [applied, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFilters = () =>
    navigation.navigate("SearchFilters", { ...params, returnTo: "Search" });

  const listParams = useMemo(() => ({ ...params, limit: PAGE_SIZE }), [params]);

  // Page 1 replaces the list; later pages append. Every page uses the same committed filters,
  // and a newer request aborts the older one so results never arrive out of order.
  const load = useCallback(
    async (p, append) => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setSt((s) => ({ ...s, loading: !append, more: append, error: null }));
      try {
        const r = await api.properties({ ...listParams, page: p }, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setItems((prev) => (append ? [...prev, ...r.items.filter((n) => !prev.some((o) => o.id === n.id))] : r.items));
        if (!append) setGeneration((g) => g + 1);
        setTotal(r.total);
        setPage(r.page);
        setPages(r.pages);
        setSt({ loading: false, more: false, error: null });
      } catch (error) {
        if (!ctrl.signal.aborted && !error.canceled) setSt({ loading: false, more: false, error });
      }
    },
    [listParams],
  );
  useEffect(() => () => inflight.current?.abort(), []);

  const firstSearch = useRef(null);
  useEffect(() => {
    if (!ready) return;
    load(1, false);
    // The resume banner describes the search the user left off at; drop it once they change it.
    const key = JSON.stringify(listParams);
    if (firstSearch.current == null) firstSearch.current = key;
    else if (key !== firstSearch.current) setResumed(false);
    const { search, city, locality, propertyType } = fs.query;
    const typeLabel = propertyType || chipLabel(fs, config, "propertyType") || "";
    const bhk = (fs.values.bhk || []).join(",");
    if (search || city || locality || typeLabel || bhk) {
      addSearchHistory({ query: search, city, locality, propertyType: typeLabel, bhk });
    }
  }, [ready, load]); // eslint-disable-line react-hooks/exhaustive-deps -- `load` changes exactly when the filters do

  // Empty results: count what each single removal would bring back, suggest the biggest wins.
  const removals = useMemo(
    () => withoutEach(fs, config).slice(0, 6).map((r) => ({ ...r, params: toQueryParams(r.state, config) })),
    [fs, config],
  );
  const noResults = ready && !st.loading && !st.error && total === 0;
  const removalCounts = useRemovalCounts(removals, { enabled: noResults });
  const suggestions = removals
    .filter((r) => removalCounts[r.id] > 0)
    .sort((a, b) => removalCounts[b.id] - removalCounts[a.id])
    .slice(0, MAX_SUGGESTIONS);

  const sortFilter = getFilter(config, fs.context, ctx?.sort);
  const sortValue = fs.values[ctx?.sort] ?? sortFilter?.default;
  const sortLabel = sortFilter?.options.find((o) => o.value === sortValue)?.label || "Sort";

  const tabs = contextIds(config).map((id) => ({ id, label: config.contexts[id].label, icon: config.contexts[id].icon }));
  const place = [fs.query.locality, fs.query.city].filter(Boolean).join(", ") || "All India";

  const apply = (next) => {
    setQuickFor(null);
    filters.replace(next);
  };

  // "Back to top" springs in once the user is a few cards down.
  const [showTop, setShowTop] = useState(false);
  const topIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const to = showTop ? 1 : 0;
    if (isReducedMotion()) topIn.setValue(to);
    else Animated.spring(topIn, { toValue: to, speed: 16, bounciness: 8, useNativeDriver: true }).start();
  }, [showTop, topIn]);
  useEffect(() => setShowTop(false), [generation]); // a new search starts back at the top
  const onScroll = (e) => {
    const far = e.nativeEvent.contentOffset.y > TOP_BUTTON_AFTER;
    if (far !== showTop) setShowTop(far);
  };

  const firstLoad = !ready || (st.loading && !items.length);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[brand.deep, brand.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.band, { paddingTop: insets.top + 6 }]}>
        <Reveal distance={8} style={styles.headRow}>
          {canPop ? (
            <PressableScale onPress={() => navigation.goBack()} to={0.88} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </PressableScale>
          ) : null}
          <View style={styles.headText}>
            <Text style={styles.headTitle} accessibilityRole="header">
              Search Results
            </Text>
            <View style={styles.placeRow}>
              <Ionicons name="location" size={12} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.placeText} numberOfLines={1}>
                {place}
              </Text>
            </View>
          </View>
          {activeCount ? (
            <View style={styles.headBadge}>
              <Text style={styles.headBadgeText}>{`${activeCount} filter${activeCount === 1 ? "" : "s"}`}</Text>
            </View>
          ) : null}
        </Reveal>

        <Reveal delay={60} distance={10} style={styles.headBody}>
          <SearchField
            value={text}
            onChange={setText}
            onSubmit={() => filters.setQuery({ search: text.trim() })}
            autoFocus={!init.city && !init.propertyType && !init.featured && !init.sort && !init.context && !init._resumed}
            onFilter={openFilters}
            filterCount={activeCount}
          />
        </Reveal>
        <Reveal delay={110} distance={10} style={styles.tabsWrap}>
          <ContextTabs tabs={tabs} value={fs.context} onChange={filters.setContext} />
        </Reveal>
      </LinearGradient>

      <Reveal delay={160} distance={10}>
        <QuickFilterBar
          state={fs}
          config={config}
          activeCount={activeCount}
          onOpenAll={openFilters}
          onOpenFilter={setQuickFor}
          onRemove={filters.clear}
          style={styles.quick}
        />

        <View style={styles.bar}>
          {/* Fixed label so screen readers announce the result, not every step of the count-up. */}
          <View
            style={styles.countRow}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={firstLoad ? "Searching" : `${total.toLocaleString("en-IN")} propert${total === 1 ? "y" : "ies"} found`}
          >
            {firstLoad ? (
              <Text style={styles.countMuted}>Searching…</Text>
            ) : (
              <Text style={styles.count}>
                <CountUp value={total} style={styles.countNum} />
                {` propert${total === 1 ? "y" : "ies"} found`}
              </Text>
            )}
            {st.loading && items.length ? <ActivityIndicator size="small" color={brand.violet} /> : null}
          </View>
          {sortFilter ? (
            <PressableScale
              onPress={() => setSortSheet(true)}
              to={0.94}
              style={styles.sort}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${sortLabel}`}
            >
              <Ionicons name="swap-vertical" size={14} color={brand.violet} />
              <Text style={styles.sortText} numberOfLines={1}>{sortLabel}</Text>
              <Ionicons name="chevron-down" size={13} color={brand.ink} />
            </PressableScale>
          ) : null}
        </View>
      </Reveal>

      {firstLoad ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <LoadingState rows={4} />
        </View>
      ) : st.error && !items.length ? (
        <ErrorState title="Unable to load results" error={st.error} onRetry={() => load(1, false)} />
      ) : (
        <FlatList
          key={generation}
          ref={listRef}
          data={items}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingTop: 2, paddingBottom: bottom + 30, gap: 14 }}
          renderItem={({ item, index }) => <PropertyCard property={item} index={index} />}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!st.more && !st.loading && page < pages) load(page + 1, true);
          }}
          ListHeaderComponent={resumed && items.length ? <ResumeBanner place={place} onClose={() => setResumed(false)} /> : null}
          ListEmptyComponent={
            <View>
              <EmptyState
                title="No results"
                message={
                  suggestions.length
                    ? "These filters are hiding the most listings. Tap one to remove it."
                    : activeCount || fs.query.search
                      ? "Try a different search or fewer filters."
                      : `No ${ctx?.label.toLowerCase() || ""} listings here yet.`
                }
              />
              {suggestions.length ? (
                <Reveal delay={220} style={styles.suggest}>
                  {suggestions.map((r) => (
                    <FilterChip
                      key={r.id}
                      label={`${r.label}  +${removalCounts[r.id].toLocaleString("en-IN")}`}
                      icon="close"
                      onPress={() => filters.replace(r.state)}
                      accessibilityLabel={`Remove ${r.label}, shows ${removalCounts[r.id]} more results`}
                    />
                  ))}
                </Reveal>
              ) : null}
              {activeCount ? (
                <Button title="Clear all filters" variant="ghost" small onPress={filters.clearAll} style={{ alignSelf: "center", marginTop: 14 }} />
              ) : null}
            </View>
          }
          ListFooterComponent={
            st.more ? (
              <ActivityIndicator color={brand.violet} style={{ margin: 16 }} />
            ) : st.error ? (
              <Button title="Retry" variant="ghost" small onPress={() => load(page + 1, true)} />
            ) : null
          }
        />
      )}

      <Animated.View
        pointerEvents={showTop ? "box-none" : "none"}
        style={[
          styles.topBtnWrap,
          {
            bottom: bottom + 16,
            opacity: topIn,
            transform: [
              { translateY: topIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: topIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          },
        ]}
      >
        <PressableScale
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: !isReducedMotion() })}
          to={0.9}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to top"
        >
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </PressableScale>
      </Animated.View>

      <QuickFilterSheet filterId={quickFor} state={fs} config={config} onApply={apply} onClose={() => setQuickFor(null)} />

      <BottomSheet visible={sortSheet} onClose={() => setSortSheet(false)} title="Sort by" maxHeight={0.55}>
        {(sortFilter?.options || []).map((o) => {
          const on = sortValue === o.value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => {
                filters.set(sortFilter.id, o.value);
                setSortSheet(false);
              }}
              style={[styles.sortRow, on && styles.sortRowActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.sortRowText, on && styles.sortRowTextOn]}>{o.label}</Text>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? brand.violet : "#C9C3D3"} />
            </PressableScale>
          );
        })}
      </BottomSheet>
    </View>
  );
}

// White search field on the violet band, with the filter button tucked in at the end.
function SearchField({ value, onChange, onSubmit, autoFocus, onFilter, filterCount }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="Search city, locality, project, developer"
        placeholderTextColor={brand.placeholder}
        style={styles.searchInput}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel="Search by city, locality, project or developer"
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={10} style={styles.searchClear} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      <PressableScale
        onPress={onFilter}
        to={0.9}
        style={styles.filterBtn}
        accessibilityRole="button"
        accessibilityLabel={filterCount ? `Filters, ${filterCount} active` : "Filters"}
      >
        <LinearGradient colors={[brand.violet, brand.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="options-outline" size={18} color={colors.white} />
        {filterCount ? (
          <View style={styles.filterDot}>
            <Text style={styles.filterDotText}>{filterCount > 9 ? "9+" : filterCount}</Text>
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
}

// "Picking up where you left off" - shown above the results when opened from Resume Search.
function ResumeBanner({ place, onClose }) {
  const v = useRef(new Animated.Value(1)).current;
  const close = () => {
    if (isReducedMotion()) return onClose();
    Animated.timing(v, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };
  return (
    <Reveal delay={200} distance={10}>
      <Animated.View style={[styles.resume, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <View style={styles.resumeIcon}>
          <Ionicons name="play-forward" size={17} color="#E0457B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resumeTitle}>Picking up where you left off</Text>
          <Text style={styles.resumeSub} numberOfLines={1}>
            {`Your last search in ${place}`}
          </Text>
        </View>
        <PressableScale onPress={close} to={0.85} hitSlop={10} style={styles.resumeClose} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={16} color={brand.inkSoft} />
        </PressableScale>
      </Animated.View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  band: { paddingBottom: 14, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 52 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, marginLeft: 6, minWidth: 0 },
  headTitle: { fontSize: 20, fontWeight: "700", color: colors.white },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  placeText: { flexShrink: 1, fontSize: 12.5, fontWeight: "600", color: "rgba(255, 255, 255, 0.82)" },
  headBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(255, 255, 255, 0.18)", marginRight: 6 },
  headBadgeText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  headBody: { paddingHorizontal: 16, marginTop: 6 },
  tabsWrap: { marginTop: 12 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 5,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink, paddingVertical: 10, paddingHorizontal: 0 },
  searchClear: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  filterBtn: { width: 40, height: 40, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  filterDot: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: brand.goldBright,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDotText: { fontSize: 9, fontWeight: "800", color: brand.ink },
  quick: { paddingTop: 14 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  count: { fontSize: 14, fontWeight: "600", color: brand.inkSoft },
  countNum: { fontSize: 15, fontWeight: "800", color: brand.ink },
  countMuted: { fontSize: 14, fontWeight: "600", color: brand.inkSoft },
  sort: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 180,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: brand.lavenderMid,
  },
  sortText: { flexShrink: 1, fontSize: 12.5, fontWeight: "700", color: brand.ink },
  suggest: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  resume: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#FFD3E2",
    ...shadow.card,
  },
  resumeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFE4EE", alignItems: "center", justifyContent: "center" },
  resumeTitle: { fontSize: 14, fontWeight: "800", color: brand.ink },
  resumeSub: { fontSize: 12, color: brand.inkSoft, marginTop: 1 },
  resumeClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  topBtnWrap: { position: "absolute", right: 20 },
  topBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.float,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 6,
  },
  sortRowActive: { backgroundColor: brand.lavender, borderColor: brand.lavenderMid },
  sortRowText: { fontSize: 15, fontWeight: "600", color: brand.ink },
  sortRowTextOn: { fontWeight: "800", color: brand.violet },
});
