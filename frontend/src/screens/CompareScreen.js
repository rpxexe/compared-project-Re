import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Button from "../components/Button";
import CompareCard, { COL_W } from "../components/CompareCard";
import PropertyCard from "../components/PropertyCard";
import SectionHeader from "../components/SectionHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useCompare } from "../context/CompareContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  COMPARE_MAX,
  buildCompareTable,
  lowestPriceIndex,
} from "../utils/compare";
import { colors, radius, shadow, glass } from "../theme";
import Text from "../components/AppText";

const LABEL_W = 96;

export default function CompareScreen({ navigation }) {
  const cmp = useCompare();
  const key = cmp.ids.join(",");
  const { data, loading, error, reload } = useApi(
    () => api.compare(cmp.ids),
    [key],
    { enabled: cmp.ids.length > 0 },
  );
  const picks = useApi(
    () =>
      api
        .properties({ limit: 8, sort: "rating" })
        .then((r) => (r.items.length ? r : api.properties({ limit: 8 }))),
    [],
  );

  const items = useMemo(() => data?.items || [], [data]);
  useEffect(() => {
    if (data) cmp.prune(items.map((i) => i.id));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => buildCompareTable(items), [items]);
  const best = useMemo(() => lowestPriceIndex(items), [items]);
  const suggestions = (picks.data?.items || []).filter((p) => !cmp.has(p.id));

  return (
    <Screen>
      <ScreenHeader
        title="Compare Project"
        subtitle={
          cmp.count
            ? `${cmp.count} of ${COMPARE_MAX} selected`
            : "Pick up to 4 projects side by side"
        }
        right={
          cmp.count ? (
            <Button title="Clear" variant="ghost" small onPress={cmp.clear} />
          ) : null
        }
      />

      {cmp.count === 0 ? (
        <EmptyState
          icon="swap-horizontal"
          title="Nothing to compare yet"
          message="Tap the compare icon on any property card to add it here. You can compare up to 4 projects."
          action="Browse projects"
          onAction={() => navigation.navigate("Search")}
        />
      ) : loading && !data ? (
        <View style={{ padding: 20 }}>
          <LoadingState rows={2} />
        </View>
      ) : error ? (
        <ErrorState
          title="Unable to load comparison"
          error={error}
          onRetry={reload}
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <View>
              <View style={{ flexDirection: "row" }}>
                <View style={{ width: LABEL_W }} />
                {items.map((p, i) => (
                  <View key={p.id} style={{ marginRight: 12 }}>
                    <CompareCard
                      property={p}
                      best={i === best}
                      onRemove={() => cmp.remove(p.id)}
                      onOpen={() =>
                        navigation.navigate("PropertyDetails", {
                          id: p.id,
                          preview: p,
                        })
                      }
                    />
                  </View>
                ))}
                {items.length < COMPARE_MAX ? (
                  <View style={[styles.add, { width: COL_W }]}>
                    <Text style={styles.addText}>
                      Add another{"\n"}from the list below
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.table}>
                {rows.map((r, ri) => (
                  <View
                    key={r.key}
                    style={[
                      styles.row,
                      ri % 2 === 0 ? styles.rowEven : styles.rowOdd,
                    ]}
                  >
                    <Text style={[styles.label, { width: LABEL_W }]}>
                      {r.label}
                    </Text>
                    {r.cells.map((c, ci) => (
                      <View key={ci} style={{ width: COL_W, marginRight: 12 }}>
                        <Text
                          style={[
                            styles.cell,
                            c === "N/A" && styles.na,
                            r.key === "price" &&
                              ci === best && {
                                color: colors.success,
                                fontWeight: "800",
                              },
                          ]}
                        >
                          {c}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                {rows.length === 0 ? (
                  <Text style={[styles.na, { padding: 16 }]}>
                    No details available for the selected projects.
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
          <View style={styles.noteWrap}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={colors.goldDeep}
            />
            <Text style={styles.note}>
              Values come directly from each project's listing. “N/A” means the
              data is not available.
            </Text>
          </View>
        </>
      )}

      {cmp.count < COMPARE_MAX && suggestions.length ? (
        <View style={{ marginTop: 28 }}>
          <SectionHeader
            title="Add projects"
            subtitle="Tap the compare icon to add"
          />
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
  table: {
    marginTop: 14,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    alignSelf: "flex-start",
    ...shadow.glass,
  },
  row: { flexDirection: "row", paddingVertical: 13, paddingLeft: 12 },
  rowEven: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  rowOdd: {
    backgroundColor: "rgba(247, 245, 250, 0.65)",
  },
  label: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  cell: {
    fontSize: 13.5,
    color: colors.ink,
    lineHeight: 19,
    fontWeight: "600",
  },
  na: { color: "#B5AFBB", fontWeight: "500" },
  add: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(212, 160, 23, 0.6)",
    backgroundColor: "rgba(253, 248, 237, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    marginRight: 20,
    ...shadow.glass,
  },
  addText: {
    textAlign: "center",
    color: colors.goldDeep,
    fontWeight: "700",
    fontSize: 12.5,
    lineHeight: 18,
  },
  noteWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.92)",
    ...shadow.glass,
  },
  note: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    flex: 1,
  },
});
