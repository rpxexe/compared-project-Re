import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import FilterChip from "../FilterChip";
import { activeFilterIds, chipLabel } from "../../utils/filterState";
import { getContext } from "../../utils/filterConfig";

// Horizontal chip row above the results. Chips come from the context's `quick` list in the
// config; an active chip shows its value ("₹50L–1Cr", "2, 3 BHK"). Both this row and the full
// filter screen read the same FilterState, so they always agree. Active filters that are not
// quick chips follow (removable), so nothing narrowing the results is ever hidden.
export default function QuickFilterBar({ state, config, activeCount, onOpenAll, onOpenFilter, onRemove, style }) {
  const ctx = getContext(config, state.context);
  if (!ctx) return null;
  const extra = activeFilterIds(state, config).filter((id) => !ctx.quick.includes(id));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]} keyboardShouldPersistTaps="handled">
      <FilterChip
        label={activeCount ? `Filters (${activeCount})` : "Filters"}
        icon="options-outline"
        active={activeCount > 0}
        onPress={onOpenAll}
        accessibilityLabel={activeCount ? `All filters, ${activeCount} active` : "All filters"}
        accessibilityHint="Opens every filter for this search"
      />
      {ctx.quick.map((id) => {
        const f = ctx.filters.find((x) => x.id === id);
        const value = chipLabel(state, config, id);
        return (
          <FilterChip
            key={id}
            label={value || f.label}
            active={!!value}
            trailingIcon="chevron-down"
            onPress={() => onOpenFilter(id)}
            accessibilityLabel={value ? `${f.label}: ${value}` : `${f.label}, not set`}
            accessibilityHint={`Opens the ${f.label.toLowerCase()} filter`}
          />
        );
      })}
      {extra.map((id) => {
        const value = chipLabel(state, config, id);
        const label = ctx.filters.find((x) => x.id === id)?.label || "Filter";
        return (
          <FilterChip
            key={id}
            label={value}
            active
            trailingIcon="close"
            onPress={() => onRemove(id)}
            accessibilityLabel={`${label}: ${value}`}
            accessibilityHint="Removes this filter"
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
});
