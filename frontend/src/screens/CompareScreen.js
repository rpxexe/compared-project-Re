import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Button from "../components/Button";
import PressableScale from "../components/PressableScale";
import PropertyCard from "../components/PropertyCard";
import SectionHeader from "../components/SectionHeader";
import ProjectCard, { AddSlot } from "../components/compare/ProjectCard";
import CompareTabs from "../components/compare/CompareTabs";
import { Cell, DetailsRow, Grid, Row, Section, smoothLayout } from "../components/compare/CompareTable";
import WhyChoose from "../components/compare/WhyChoose";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useCompare } from "../context/CompareContext";
import { useApi } from "../hooks/useApi";
import { useEntrance } from "../hooks/useEntrance";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { api } from "../services/api";
import { addCompareHistory } from "../services/historyService";
import { COMPARE_MAX, KEY_ROWS, LOCATION_ROWS, amenityMatrix, buildRows, insights, overallPick } from "../utils/compare";
import { brand, colors, radius } from "../theme";
import Text from "../components/AppText";

const TABS = [
  { key: "key", label: "Key Comparison", icon: "bar-chart-outline" },
  { key: "amenities", label: "Amenities", icon: "star-outline" },
  { key: "location", label: "Location & Connectivity", icon: "location-outline" },
];
const AMENITY_PREVIEW = 10;
const GAP = 10;

export default function CompareScreen({ navigation }) {
  const cmp = useCompare();
  const key = cmp.ids.join(",");
  const { data, loading, error, reload } = useApi(() => api.compare(cmp.ids), [key], { enabled: cmp.ids.length > 0 });
  const picks = useApi(
    () => api.properties({ limit: 8, sort: "rating" }).then((r) => (r.items.length ? r : api.properties({ limit: 8 }))),
    [],
  );
  const [tab, setTab] = useState("key");
  const [allAmenities, setAllAmenities] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const headerIn = useEntrance(0, 12);

  // Removing is instant on screen; the refetch for the new id list happens behind it.
  const items = useMemo(() => (data?.items || []).filter((i) => cmp.ids.includes(i.id)), [data, cmp.ids]);
  useEffect(() => {
    if (data) cmp.prune(data.items.map((i) => i.id));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Remember each set of 2+ projects the user actually saw side by side (Home > Recent Compares).
  const loadedKey = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (items.length >= 2) addCompareHistory(items);
  }, [loadedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const keyRows = useMemo(() => buildRows(items, KEY_ROWS), [items]);
  const locationRows = useMemo(() => buildRows(items, LOCATION_ROWS), [items]);
  const amenities = useMemo(() => amenityMatrix(items), [items]);
  const tips = useMemo(() => insights(items), [items]);
  const pick = useMemo(() => overallPick(keyRows, items.length), [keyRows, items.length]);
  const suggestions = (picks.data?.items || []).filter((p) => !cmp.has(p.id));

  const { width } = useWindowDimensions();
  const frame = Math.min(width, 760) - 32;
  const cardW = Math.floor((frame - GAP * 2) / 3);
  const n = Math.max(items.length, 1);
  const labelW = n >= 3 ? 98 : 118;
  const inner = frame - 2;
  const colW = Math.max(96, Math.floor((inner - labelW) / n));
  const fits = labelW + colW * n <= inner;

  const open = (p) => navigation.navigate("PropertyDetails", { id: p.id, preview: p });
  const remove = (id) => {
    smoothLayout();
    cmp.remove(id);
  };
  const clearAll = () => {
    if (isReducedMotion()) return cmp.clear();
    Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      cmp.clear();
      fade.setValue(1);
    });
  };
  const switchTab = (t) => {
    if (t === tab) return;
    smoothLayout();
    setTab(t);
  };

  const badgeFor = (i) =>
    tips.find((t) => t.index === i) || (items[i].featured ? { key: "featured", badge: "Featured" } : null);

  const renderRows = (rows) =>
    rows.map((r, ri) => (
      <Row key={r.key} index={ri} label={r.label} icon={r.icon} labelW={labelW}>
        {r.cells.map((c, ci) =>
          r.link && r.raw[ci] ? (
            <Cell key={ci} width={colW}>
              <PressableScale onPress={() => Linking.openURL(r.raw[ci])} to={0.92} style={styles.mapBtn} accessibilityRole="link">
                <Ionicons name="map-outline" size={13} color={brand.violet} />
                <Text style={styles.mapText}>Open map</Text>
              </PressableScale>
            </Cell>
          ) : (
            <Cell key={ci} width={colW} text={c} muted={c === "N/A"} win={r.winners.includes(ci)} delay={ri * 45} />
          ),
        )}
      </Row>
    ));

  const amenityRows = allAmenities ? amenities.rows : amenities.rows.slice(0, AMENITY_PREVIEW);

  return (
    <Screen>
      <Animated.View style={headerIn}>
        <ScreenHeader
          back
          title="Compare Project"
          subtitle={`Compare up to ${COMPARE_MAX} properties and find the best one`}
          right={
            cmp.count ? (
              <PressableScale onPress={clearAll} to={0.92} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear all compared projects">
                <Ionicons name="trash-outline" size={15} color={colors.error} />
                <Text style={styles.clearText}>Clear All</Text>
              </PressableScale>
            ) : null
          }
        />
      </Animated.View>

      {cmp.count === 0 ? (
        <EmptyState
          icon="swap-horizontal"
          title="Nothing to compare yet"
          message={`Tap the compare icon on any property card to add it here. You can compare up to ${COMPARE_MAX} projects.`}
          action="Browse projects"
          onAction={() => navigation.navigate("Search")}
        />
      ) : loading && !data ? (
        <View style={{ padding: 20 }}>
          <LoadingState rows={2} />
        </View>
      ) : error && !data ? (
        <ErrorState title="Unable to load comparison" error={error} onRetry={reload} />
      ) : (
        <Animated.View style={{ opacity: fade }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {items.map((p, i) => (
              <ProjectCard
                key={p.id}
                property={p}
                index={i}
                width={cardW}
                badge={badgeFor(i)}
                onOpen={() => open(p)}
                onRemove={() => remove(p.id)}
              />
            ))}
            {items.length < COMPARE_MAX ? (
              <AddSlot width={cardW} index={items.length} onPress={() => navigation.navigate("Search")} />
            ) : null}
          </ScrollView>

          <CompareTabs tabs={TABS} value={tab} onChange={switchTab} />

          <View style={{ marginTop: 10 }}>
            {tab === "key" ? (
              <View key="key" style={styles.flat}>
                <Grid items={items} labelW={labelW} colW={colW} fits={fits}>
                  {renderRows(keyRows)}
                  <DetailsRow items={items} labelW={labelW} colW={colW} pick={pick} onOpen={open} />
                </Grid>
              </View>
            ) : tab === "amenities" ? (
              <Section key="amenities" title="Amenities" icon="star-outline">
                {amenities.rows.length ? (
                  <Grid items={items} labelW={labelW} colW={colW} fits={fits}>
                    <Row index={0} label="Total listed" icon="list-outline" labelW={labelW}>
                      {amenities.counts.map((c, ci) => (
                        <Cell key={ci} width={colW} text={String(c)} muted={c === 0} win={amenities.winners.includes(ci)} />
                      ))}
                    </Row>
                    {amenityRows.map((r, ri) => (
                      <Row key={r.name} index={ri + 1} label={r.name} labelW={labelW} last={ri === amenityRows.length - 1}>
                        {r.has.map((has, ci) => (
                          <Cell key={ci} width={colW}>
                            <Ionicons
                              name={has ? "checkmark-circle" : "close-circle-outline"}
                              size={19}
                              color={has ? colors.success : "#C9C3D3"}
                              accessibilityLabel={has ? "Available" : "Not listed"}
                            />
                          </Cell>
                        ))}
                      </Row>
                    ))}
                  </Grid>
                ) : (
                  <Text style={styles.none}>None of these projects list amenities yet.</Text>
                )}
                {amenities.rows.length > AMENITY_PREVIEW ? (
                  <PressableScale
                    onPress={() => {
                      smoothLayout();
                      setAllAmenities((v) => !v);
                    }}
                    to={0.96}
                    style={styles.more}
                  >
                    <Text style={styles.moreText}>
                      {allAmenities ? "Show fewer" : `Show all ${amenities.rows.length} amenities`}
                    </Text>
                    <Ionicons name={allAmenities ? "chevron-up" : "chevron-down"} size={15} color={brand.violet} />
                  </PressableScale>
                ) : null}
              </Section>
            ) : (
              <Section key="location" title="Location & Connectivity" icon="location-outline">
                {locationRows.length ? (
                  <Grid items={items} labelW={labelW} colW={colW} fits={fits}>
                    {renderRows(locationRows)}
                  </Grid>
                ) : (
                  <Text style={styles.none}>No location details are listed for these projects.</Text>
                )}
              </Section>
            )}
          </View>

          <WhyChoose insights={tips} items={items} tileW={Math.max(cardW + 30, 150)} onOpen={open} />

          <View style={styles.noteWrap}>
            <Ionicons name="information-circle-outline" size={15} color={colors.goldDeep} />
            <Text style={styles.note}>
              Values come directly from each project's listing. “N/A” means the data is not available.
            </Text>
          </View>
        </Animated.View>
      )}

      {cmp.count < COMPARE_MAX && suggestions.length ? (
        <View style={{ marginTop: 28 }}>
          <SectionHeader title="Add projects" subtitle="Tap the compare icon to add" />
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {suggestions.slice(0, 6).map((p, i) => (
              <PropertyCard key={p.id} property={p} index={i} />
            ))}
          </View>
          <Button
            title="Search more projects"
            variant="ghost"
            onPress={() => navigation.navigate("Search")}
            style={{ marginHorizontal: 20, marginTop: 16 }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: "#F5C2C2",
    backgroundColor: "#FFF6F6",
  },
  clearText: { fontSize: 12.5, fontWeight: "800", color: colors.error },
  cards: { paddingHorizontal: 16, gap: GAP, paddingTop: 2, paddingBottom: 14 },
  flat: { marginHorizontal: 16 },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapText: { fontSize: 12, fontWeight: "800", color: brand.violet },
  none: { padding: 16, fontSize: 13, color: colors.muted },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  moreText: { fontSize: 12.5, fontWeight: "800", color: brand.violet },
  noteWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.92)",
  },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17, flex: 1 },
});
