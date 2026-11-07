import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useBottomSpace } from "../hooks/useBottomSpace";
import FilterChip from "../components/FilterChip";
import { badgeFor } from "../components/PropertyCard";
import ListingCard, { ListingCardSkeleton, ListingSkeletonList } from "../components/search/ListingCard";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import CountUp from "../components/CountUp";
import Reveal from "../components/Reveal";
import { EmptyState, ErrorState } from "../components/StateViews";
import QuickFilterSheet from "../components/filters/QuickFilterSheet";
import { api } from "../services/api";
import PressableScale from "../components/PressableScale";
import { brand, colors, radius, shadow } from "../theme";
import { addSearchHistory } from "../services/historyService";
import { useFilterState } from "../hooks/useFilterState";
import { useRemovalCounts } from "../hooks/useLiveCount";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { getContext, getFilter } from "../utils/filterConfig";
import { activeFilterIds, chipLabel, fromQueryParams, toQueryParams, withoutEach } from "../utils/filterState";
import Text from "../components/AppText";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 12;
const MAX_SUGGESTIONS = 4;
const TOP_BUTTON_AFTER = 700; // px scrolled before "back to top" appears

// Results for a search: a light header (back, title + live count, notifications, filters), one row
// of location / budget / active-filter chips with Sort on the right, then the listing cards.
export default function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bottom } = useBottomSpace();
  const init = route.params || {};
  const filters = useFilterState(init);
  const { state: fs, config, params, ready, activeCount } = filters;
  const ctx = getContext(config, fs.context);
  const canPop = (navigation.getState()?.index ?? 0) > 0;

  const [quickFor, setQuickFor] = useState(null);
  const [sortSheet, setSortSheet] = useState(false);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [st, setSt] = useState({ loading: true, more: false, error: null });
  // Bumped on every fresh page 1, remounting the list so the cards replay their entrance.
  const [generation, setGeneration] = useState(0);
  const inflight = useRef(null);
  const listRef = useRef(null);

  // Unread notifications (signed-in users only) for the bell's dot; refreshed on focus.
  const { token } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => navigation.addListener("focus", () => {
    if (!token) return setUnread(0);
    api.notifications().then((r) => setUnread(r?.unreadCount || 0)).catch(() => {});
  }), [navigation, token]);

  // Coming back from the filter form with a new search (`_applied` changes each time).
  const applied = route.params?._applied;
  useEffect(() => {
    if (!applied || !ready) return;
    const next = fromQueryParams(route.params, config, fs.context);
    if (filters.isSame(next)) return; // first mount already started from these params
    filters.replace(next);
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

  useEffect(() => {
    if (!ready) return;
    load(1, false);
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

  const place = [fs.query.locality, fs.query.city].filter(Boolean).join(", ") || "All India";
  const budget = ctx?.filters.find((f) => f.id === "budget");
  // Every other active filter stays visible (and removable), so nothing narrowing results hides.
  const extraFilters = activeFilterIds(fs, config).filter((id) => id !== budget?.id && id !== ctx?.sort);
  // Listings carry no sale/rent flag; the search's context says which it is.
  const tagFor = (p) => (fs.context === "rent_residential" ? "For Rent" : fs.context === "new_projects" ? badgeFor(p) || "New Project" : "For Sale");

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
      <StatusBar style="dark" />
      <Reveal distance={8} style={[styles.headRow, { paddingTop: insets.top + 6 }]}>
        {canPop ? (
          <PressableScale onPress={() => navigation.goBack()} to={0.88} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={brand.ink} />
          </PressableScale>
        ) : null}
        {/* Fixed label so screen readers announce the result, not every step of the count-up. */}
        <View
          style={styles.headText}
          accessible
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          accessibilityLabel={firstLoad ? "Search results, searching" : `Search results, ${total.toLocaleString("en-IN")} propert${total === 1 ? "y" : "ies"} found`}
        >
          <Text style={styles.headTitle}>Search Results</Text>
          <View style={styles.countRow}>
            {firstLoad ? (
              <Text style={styles.count}>Searching…</Text>
            ) : (
              <Text style={styles.count}>
                <CountUp value={total} style={styles.count} />
                {` Propert${total === 1 ? "y" : "ies"} Found`}
              </Text>
            )}
            {st.loading && items.length ? <ActivityIndicator size="small" color={brand.violet} /> : null}
          </View>
        </View>
        <PressableScale
          onPress={() => navigation.navigate("Notification")}
          to={0.88}
          hitSlop={6}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Ionicons name="notifications-outline" size={22} color={brand.ink} />
          {unread ? <View style={styles.bellDot} /> : null}
        </PressableScale>
        <PressableScale
          onPress={openFilters}
          to={0.88}
          hitSlop={6}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : "Filters"}
        >
          <Ionicons name="options-outline" size={23} color={brand.ink} />
          {activeCount ? (
            <View style={styles.filterDot}>
              <Text style={styles.filterDotText}>{activeCount > 9 ? "9+" : activeCount}</Text>
            </View>
          ) : null}
        </PressableScale>
      </Reveal>

      {/* Location, budget and any other active filter, with Sort pinned on the right. */}
      <Reveal delay={60} distance={10} style={styles.bar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          <Pill
            icon="location-outline"
            label={place}
            onPress={openFilters}
            onClear={fs.query.city || fs.query.locality ? () => filters.setQuery({ city: "", locality: "" }) : null}
            accessibilityLabel={`Location: ${place}`}
          />
          {fs.query.search ? (
            <Pill icon="search" label={`"${fs.query.search}"`} onClear={() => filters.setQuery({ search: "" })} accessibilityLabel={`Search: ${fs.query.search}`} />
          ) : null}
          {budget ? (
            <Pill
              label={chipLabel(fs, config, budget.id) || "Budget"}
              active={!!chipLabel(fs, config, budget.id)}
              trailing="chevron-down"
              onPress={() => setQuickFor(budget.id)}
              accessibilityLabel={`Budget: ${chipLabel(fs, config, budget.id) || "any"}`}
            />
          ) : null}
          {extraFilters.map((id) => {
            const label = ctx.filters.find((x) => x.id === id)?.label || "Filter";
            const value = chipLabel(fs, config, id);
            return <Pill key={id} label={value} active onClear={() => filters.clear(id)} accessibilityLabel={`${label}: ${value}`} />;
          })}
        </ScrollView>
        {sortFilter ? (
          <PressableScale
            onPress={() => setSortSheet(true)}
            to={0.94}
            style={styles.sort}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sortLabel}`}
          >
            <Text style={styles.sortText} numberOfLines={1}>
              <Text style={styles.sortMuted}>Sort: </Text>
              {sortLabel}
            </Text>
            <Ionicons name="chevron-down" size={13} color={brand.ink} />
          </PressableScale>
        ) : null}
      </Reveal>

      {firstLoad ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ListingSkeletonList rows={4} />
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
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: bottom + 30, gap: 12 }}
          renderItem={({ item, index }) => <ListingCard property={item} index={index} tag={tagFor(item)} />}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!st.more && !st.loading && page < pages) load(page + 1, true);
          }}
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
              <ListingCardSkeleton />
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

// Rounded chip for the filter row: optional icon, tap to edit, x to clear.
function Pill({ icon, label, active, trailing, onPress, onClear, accessibilityLabel, accessibilityHint }) {
  return (
    <PressableScale
      onPress={onPress || onClear}
      to={0.95}
      style={[styles.pill, active && styles.pillOn]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint || (onPress ? "Edit" : "Removes this filter")}
    >
      {icon ? <Ionicons name={icon} size={14} color={brand.ink} /> : null}
      <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
          <Ionicons name="close" size={14} color={brand.ink} />
        </Pressable>
      ) : trailing ? (
        <Ionicons name={trailing} size={13} color={brand.ink} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  headRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 },
  iconBtn: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, marginLeft: 4, minWidth: 0 },
  headTitle: { fontSize: 21, fontWeight: "800", color: brand.ink },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  count: { fontSize: 12.5, fontWeight: "600", color: brand.inkSoft },
  bellDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 1.5, borderColor: brand.bg },
  filterDot: {
    position: "absolute",
    top: 5,
    right: 3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDotText: { fontSize: 9, fontWeight: "800", color: colors.white },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 16, paddingTop: 6, paddingBottom: 8 },
  chips: { paddingLeft: 16, paddingRight: 4, gap: 8, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 220,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: brand.lavenderMid,
  },
  pillOn: { backgroundColor: brand.lavender, borderColor: brand.violet },
  pillText: { flexShrink: 1, fontSize: 12.5, fontWeight: "700", color: brand.ink },
  sort: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 150, height: 34 },
  sortText: { flexShrink: 1, fontSize: 12.5, fontWeight: "800", color: brand.ink },
  sortMuted: { fontWeight: "600", color: brand.inkSoft },
  suggest: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
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
