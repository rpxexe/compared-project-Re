import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import SearchBar from "../components/SearchBar";
import FilterChip from "../components/FilterChip";
import PropertyCard from "../components/PropertyCard";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import Input from "../components/Input";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { api } from "../services/api";
import PressableScale from "../components/PressableScale";
import Screen from "../components/Screen";
import { colors, radius, shadow, glass } from "../theme";
import { addSearchHistory } from "../services/historyService";

const BHKS = ["1", "2", "3", "4", "5+"];
const PRICES = [
  { label: "Under ₹50 L", maxPrice: 5000000 },
  { label: "₹50 L – 1 Cr", minPrice: 5000000, maxPrice: 10000000 },
  { label: "₹1 – 2 Cr", minPrice: 10000000, maxPrice: 20000000 },
  { label: "₹2 – 5 Cr", minPrice: 20000000, maxPrice: 50000000 },
  { label: "₹5 Cr +", minPrice: 50000000 },
];
const POSSESSION = ["Ready", "Under Construction", "New Launch", "Upcoming"];
const SORTS = [
  { k: "", l: "Newest" },
  { k: "price_asc", l: "Price: low to high" },
  { k: "price_desc", l: "Price: high to low" },
  { k: "rating", l: "Top rated" },
];
const EMPTY = {
  city: "",
  locality: "",
  propertyType: "",
  bhk: "",
  minPrice: "",
  maxPrice: "",
  minArea: "",
  maxArea: "",
  possession: "",
  developer: "",
  condition: "",
  featured: false,
};

const priceKey = (f) =>
  PRICES.findIndex(
    (p) =>
      String(p.minPrice || "") === String(f.minPrice || "") &&
      String(p.maxPrice || "") === String(f.maxPrice || ""),
  );
const activeCount = (f) =>
  Object.entries(f).filter(([, v]) => v !== "" && v !== false).length;

function Group({ title, children }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.gTitle}>{title}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

export default function SearchScreen({ route }) {
  const insets = useSafeAreaInsets();
  const init = route.params || {};
  const [text, setText] = useState(init.search || "");
  const [query, setQuery] = useState(init.search || "");
  const [filters, setFilters] = useState({
    ...EMPTY,
    ...Object.fromEntries(Object.entries(init).filter(([k]) => k in EMPTY)),
  });
  const [sort, setSort] = useState(init.sort || "");
  const [sheet, setSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [facets, setFacets] = useState({ cities: [], propertyTypes: [] });

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState({
    loading: true,
    more: false,
    error: null,
  });
  const seq = useRef(0);

  useEffect(() => {
    api
      .facets()
      .then(setFacets)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]); // debounce typing

  const params = useMemo(
    () => ({ ...filters, search: query, sort, limit: 12 }),
    [filters, query, sort],
  );

  const load = useCallback(
    async (p, append) => {
      const id = ++seq.current;
      setState((s) => ({ ...s, loading: !append, more: append, error: null }));
      try {
        const r = await api.properties({ ...params, page: p });
        if (id !== seq.current) return;
        setItems((prev) =>
          append
            ? [
                ...prev,
                ...r.items.filter((n) => !prev.some((o) => o.id === n.id)),
              ]
            : r.items,
        );
        setTotal(r.total);
        setPage(r.page);
        setPages(r.pages);
        setState({ loading: false, more: false, error: null });
      } catch (error) {
        if (id === seq.current)
          setState({ loading: false, more: false, error });
      }
    },
    [params],
  );
  useEffect(() => {
    load(1, false);
    if (query || filters.city || filters.locality || filters.propertyType || filters.bhk) {
      addSearchHistory({
        query,
        city: filters.city,
        locality: filters.locality,
        propertyType: filters.propertyType,
        bhk: filters.bhk,
      });
    }
  }, [load, query, filters.city, filters.locality, filters.propertyType, filters.bhk]);

  const count = activeCount(filters);
  const chips = [];
  if (filters.city) chips.push(["city", filters.city]);
  if (filters.propertyType) chips.push(["propertyType", filters.propertyType]);
  if (filters.bhk) chips.push(["bhk", `${filters.bhk} BHK`]);
  if (priceKey(filters) >= 0)
    chips.push(["price", PRICES[priceKey(filters)].label]);
  if (filters.possession) chips.push(["possession", filters.possession]);
  if (filters.condition)
    chips.push(["condition", filters.condition === "new" ? "New" : "Resale"]);
  if (filters.developer) chips.push(["developer", filters.developer]);
  if (filters.locality) chips.push(["locality", filters.locality]);
  if (filters.featured) chips.push(["featured", "Featured"]);
  if (filters.minArea || filters.maxArea)
    chips.push([
      "area",
      `${filters.minArea || 0}–${filters.maxArea || "∞"} sq.ft`,
    ]);

  const removeChip = (k) =>
    setFilters((f) =>
      k === "price"
        ? { ...f, minPrice: "", maxPrice: "" }
        : k === "area"
          ? { ...f, minArea: "", maxArea: "" }
          : { ...f, [k]: k === "featured" ? false : "" },
    );
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: d[k] === v ? "" : v }));
  const setPrice = (p) =>
    setDraft((d) =>
      priceKey(d) === PRICES.indexOf(p)
        ? { ...d, minPrice: "", maxPrice: "" }
        : {
            ...d,
            minPrice: p.minPrice ? String(p.minPrice) : "",
            maxPrice: p.maxPrice ? String(p.maxPrice) : "",
          },
    );
  const sortLabel = SORTS.find((s) => s.k === sort)?.l || "Newest";
  console.log(init);
  return (
    <Screen scroll={false} padTop={false} padBottom={false} style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8 }}>
        <ScreenHeader title="Search" back />
        <View style={{ paddingHorizontal: 20 }}>
          <SearchBar
            value={text}
            onChangeText={setText}
            onSubmit={() => setQuery(text.trim())}
            autoFocus={
              !init.city && !init.propertyType && !init.featured && !init.sort
            }
            onFilter={() => {
              setDraft(filters);
              setSheet(true);
            }}
            filterCount={count}
          />
        </View>
        {chips.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              gap: 8,
              paddingTop: 12,
            }}
          >
            {chips.map(([k, l]) => (
              <PressableScale
                key={k}
                onPress={() => removeChip(k)}
                style={styles.applied}
              >
                <Text style={styles.appliedText}>{l}</Text>
                <Ionicons name="close" size={14} color={colors.ink} />
              </PressableScale>
            ))}
            <Pressable
              onPress={() => setFilters(EMPTY)}
              style={{ justifyContent: "center", paddingHorizontal: 6 }}
            >
              <Text style={styles.clear}>Clear all</Text>
            </Pressable>
          </ScrollView>
        ) : null}
        <View style={styles.bar}>
          <Text style={styles.count}>
            {state.loading && !items.length
              ? "Searching…"
              : `${total} propert${total === 1 ? "y" : "ies"} found`}
          </Text>
          <PressableScale
            onPress={() => setSortSheet(true)}
            style={styles.sort}
            hitSlop={8}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.ink} />
            <Text style={styles.sortText}>{sortLabel}</Text>
          </PressableScale>
        </View>
      </View>

      {state.loading && !items.length ? (
        <View style={{ padding: 20 }}>
          <LoadingState rows={4} />
        </View>
      ) : state.error && !items.length ? (
        <ErrorState
          title="Unable to load results"
          error={state.error}
          onRetry={() => load(1, false)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingTop: 6,
            paddingBottom: insets.bottom + 30,
            gap: 14,
          }}
          renderItem={({ item, index }) => (
            <PropertyCard property={item} index={index} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!state.more && !state.loading && page < pages)
              load(page + 1, true);
          }}
          ListEmptyComponent={
            <EmptyState
              title="No properties found"
              message="Try a different search or clear some filters."
              action={count || query ? "Clear filters" : undefined}
              onAction={() => {
                setFilters(EMPTY);
                setText("");
              }}
            />
          }
          ListFooterComponent={
            state.more ? (
              <ActivityIndicator color={colors.gold} style={{ margin: 16 }} />
            ) : state.error ? (
              <Button
                title="Retry"
                variant="ghost"
                small
                onPress={() => load(page + 1, true)}
              />
            ) : null
          }
        />
      )}

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460 }}
        >
          {facets.cities.length ? (
            <Group title="City">
              {facets.cities.slice(0, 20).map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={draft.city === c}
                  onPress={() => set("city", c)}
                />
              ))}
            </Group>
          ) : null}
          {facets.propertyTypes.length ? (
            <Group title="Property type">
              {facets.propertyTypes.map((t) => (
                <FilterChip
                  key={t}
                  label={t}
                  active={draft.propertyType === t}
                  onPress={() => set("propertyType", t)}
                />
              ))}
            </Group>
          ) : null}
          <Group title="BHK">
            {BHKS.map((b) => (
              <FilterChip
                key={b}
                label={`${b} BHK`}
                active={draft.bhk === b}
                onPress={() => set("bhk", b)}
              />
            ))}
          </Group>
          <Group title="Price range">
            {PRICES.map((p) => (
              <FilterChip
                key={p.label}
                label={p.label}
                active={priceKey(draft) === PRICES.indexOf(p)}
                onPress={() => setPrice(p)}
              />
            ))}
          </Group>
          <Group title="Possession">
            {POSSESSION.map((p) => (
              <FilterChip
                key={p}
                label={p}
                active={draft.possession === p}
                onPress={() => set("possession", p)}
              />
            ))}
          </Group>
          <Group title="Listing">
            <FilterChip
              label="New"
              active={draft.condition === "new"}
              onPress={() => set("condition", "new")}
            />
            <FilterChip
              label="Resale"
              active={draft.condition === "resale"}
              onPress={() => set("condition", "resale")}
            />
            <FilterChip
              label="Featured only"
              icon="star"
              active={!!draft.featured}
              onPress={() => setDraft((d) => ({ ...d, featured: !d.featured }))}
            />
          </Group>
          <Text style={styles.gTitle}>Area (sq.ft)</Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
            <Input
              style={{ flex: 1 }}
              placeholder="Min"
              keyboardType="number-pad"
              value={draft.minArea}
              onChangeText={(v) =>
                setDraft((d) => ({ ...d, minArea: v.replace(/\D/g, "") }))
              }
            />
            <Input
              style={{ flex: 1 }}
              placeholder="Max"
              keyboardType="number-pad"
              value={draft.maxArea}
              onChangeText={(v) =>
                setDraft((d) => ({ ...d, maxArea: v.replace(/\D/g, "") }))
              }
            />
          </View>
          <Input
            label="Locality"
            placeholder="e.g. Andheri"
            value={draft.locality}
            onChangeText={(v) => setDraft((d) => ({ ...d, locality: v }))}
            style={{ marginBottom: 14 }}
          />
          <Input
            label="Developer"
            placeholder="e.g. builder name"
            value={draft.developer}
            onChangeText={(v) => setDraft((d) => ({ ...d, developer: v }))}
          />
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <Button
            title="Clear"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => setDraft(EMPTY)}
          />
          <Button
            title="Show results"
            style={{ flex: 2 }}
            onPress={() => {
              setFilters(draft);
              setSheet(false);
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sortSheet}
        onClose={() => setSortSheet(false)}
        title="Sort by"
        maxHeight={0.5}
      >
        {SORTS.map((s) => (
          <PressableScale
            key={s.k || "new"}
            onPress={() => {
              setSort(s.k);
              setSortSheet(false);
            }}
            style={[
              styles.sortRow,
              sort === s.k && styles.sortRowActive,
            ]}
          >
            <Text
              style={[
                styles.sortRowText,
                sort === s.k && { fontWeight: "800", color: colors.goldDeep },
              ]}
            >
              {s.l}
            </Text>
            {sort === s.k ? (
              <Ionicons name="checkmark" size={18} color={colors.goldDeep} />
            ) : null}
          </PressableScale>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  count: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  sort: { flexDirection: "row", alignItems: "center", gap: 6 },
  sortText: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  applied: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(253, 248, 237, 0.92)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 32,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.45)",
    ...shadow.glass,
  },
  appliedText: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  clear: { color: colors.goldDeep, fontWeight: "800", fontSize: 13 },
  gTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
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
