import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomSpace } from "../hooks/useBottomSpace";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import SearchBar from "../components/SearchBar";
import FilterChip from "../components/FilterChip";
import PropertyCard from "../components/PropertyCard";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import QuickFilterBar from "../components/filters/QuickFilterBar";
import QuickFilterSheet from "../components/filters/QuickFilterSheet";
import { api } from "../services/api";
import PressableScale from "../components/PressableScale";
import Screen from "../components/Screen";
import { colors, radius, shadow } from "../theme";
import { addSearchHistory } from "../services/historyService";
import { useFilterState } from "../hooks/useFilterState";
import { useRemovalCounts } from "../hooks/useLiveCount";
import { contextIds, getContext, getFilter } from "../utils/filterConfig";
import { chipLabel, fromQueryParams, toQueryParams, withoutEach } from "../utils/filterState";
import Text from "../components/AppText";

const PAGE_SIZE = 12;
const MAX_SUGGESTIONS = 4;

export default function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bottom, tabBar, inset } = useBottomSpace();
  const init = route.params || {};
  const filters = useFilterState(init);
  const { state: fs, config, params, ready, activeCount } = filters;
  const ctx = getContext(config, fs.context);

  const [text, setText] = useState(init.search || "");
  const [quickFor, setQuickFor] = useState(null);
  const [sortSheet, setSortSheet] = useState(false);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [st, setSt] = useState({ loading: true, more: false, error: null });
  const inflight = useRef(null);

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

  const apply = (next) => {
    setQuickFor(null);
    filters.replace(next);
  };

  return (
    <Screen scroll={false} padTop={false} padBottom={false} style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8 }}>
        <ScreenHeader title="Search" back />
        <View style={{ paddingHorizontal: 20 }}>
          <SearchBar
            value={text}
            onChangeText={setText}
            onSubmit={() => filters.setQuery({ search: text.trim() })}
            autoFocus={!init.city && !init.propertyType && !init.featured && !init.sort && !init.context}
            onFilter={openFilters}
            filterCount={activeCount}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contexts}
          accessibilityRole="tablist"
        >
          {contextIds(config).map((id) => {
            const on = id === fs.context;
            return (
              <PressableScale
                key={id}
                onPress={() => !on && filters.setContext(id)}
                style={[styles.ctx, on && styles.ctxOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${config.contexts[id].label} listings`}
              >
                <Text style={[styles.ctxText, on && styles.ctxTextOn]}>{config.contexts[id].label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <QuickFilterBar
          state={fs}
          config={config}
          activeCount={activeCount}
          onOpenAll={openFilters}
          onOpenFilter={setQuickFor}
          onRemove={filters.clear}
        />

        <View style={styles.bar}>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {st.loading && !items.length ? "Searching…" : `${total.toLocaleString("en-IN")} propert${total === 1 ? "y" : "ies"} found`}
          </Text>
          {sortFilter ? (
            <PressableScale
              onPress={() => setSortSheet(true)}
              style={styles.sort}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${sortLabel}`}
            >
              <Ionicons name="swap-vertical" size={16} color={colors.ink} />
              <Text style={styles.sortText}>{sortLabel}</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>

      {!ready || (st.loading && !items.length) ? (
        <View style={{ padding: 20 }}>
          <LoadingState rows={4} />
        </View>
      ) : st.error && !items.length ? (
        <ErrorState title="Unable to load results" error={st.error} onRetry={() => load(1, false)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: bottom + 30, gap: 14 }}
          renderItem={({ item, index }) => <PropertyCard property={item} index={index} />}
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
                <View style={styles.suggest}>
                  {suggestions.map((r) => (
                    <FilterChip
                      key={r.id}
                      label={`${r.label}  +${removalCounts[r.id].toLocaleString("en-IN")}`}
                      icon="close"
                      onPress={() => filters.replace(r.state)}
                      accessibilityLabel={`Remove ${r.label}, shows ${removalCounts[r.id]} more results`}
                    />
                  ))}
                </View>
              ) : null}
              {activeCount ? (
                <Button title="Clear all filters" variant="ghost" small onPress={filters.clearAll} style={{ alignSelf: "center", marginTop: 14 }} />
              ) : null}
            </View>
          }
          ListFooterComponent={
            st.more ? (
              <ActivityIndicator color={colors.gold} style={{ margin: 16 }} />
            ) : st.error ? (
              <Button title="Retry" variant="ghost" small onPress={() => load(page + 1, true)} />
            ) : null
          }
        />
      )}

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
              <Text style={[styles.sortRowText, on && { fontWeight: "800", color: colors.goldDeep }]}>{o.label}</Text>
              {on ? <Ionicons name="checkmark" size={18} color={colors.goldDeep} /> : null}
            </PressableScale>
          );
        })}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  contexts: { paddingHorizontal: 20, gap: 6, paddingTop: 12, paddingBottom: 8 },
  ctx: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  ctxOn: {
    backgroundColor: "rgba(253, 248, 237, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.45)",
    ...shadow.glass,
  },
  ctxText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  ctxTextOn: { color: colors.ink, fontWeight: "800" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  count: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  sortText: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  suggest: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    minHeight: 48,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  sortRowActive: {
    backgroundColor: "rgba(253, 248, 237, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.45)",
    ...shadow.glass,
  },
  sortRowText: { fontSize: 15.5, color: colors.ink },
});
