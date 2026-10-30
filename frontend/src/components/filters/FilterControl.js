import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toggle from "../Toggle";
import DualSlider, { maxToIndex, minToIndex } from "./DualSlider";
import { brand, colors, radius } from "../../theme";
import { formatStep, unitLabel } from "../../utils/filterState";
import Text from "../AppText";

// Renders one filter from its config entry, in the style its `display` asks for. Controlled:
// `value` is the FilterState value (undefined = default); changes go out through onChange.
// `title` = false hides the heading (e.g. inside a sheet that already shows it).
// `wrap` lays options out in wrapping rows instead of a sideways scroll (narrow panels).
export default function FilterControl({ filter, value, onChange, title = true, wrap = false }) {
  if (filter.type === "toggle") {
    return (
      <Pressable
        onPress={() => onChange(!value)}
        style={styles.toggleRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!value }}
        accessibilityLabel={filter.label}
      >
        <Text style={styles.toggleText}>{filter.label}</Text>
        {/* The row is the switch for screen readers; the visual toggle is hidden from them. */}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Toggle value={!!value} onPress={() => onChange(!value)} accessibilityLabel={filter.label} />
        </View>
      </Pressable>
    );
  }
  if (filter.type === "range") return <RangeSelect filter={filter} value={value} onChange={onChange} title={title} />;

  const multi = filter.type === "multi_select";
  const selected = multi ? value || [] : [value ?? filter.default];
  const pick = (v) => onChange(multi ? (selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]) : v);
  const Body = { tiles: Tiles, checkbox: Checkboxes, segmented: Segmented }[filter.display] || Pills;
  return (
    <View>
      {title ? <Text style={styles.title} accessibilityRole="header">{filter.label}</Text> : null}
      <Body filter={filter} selected={selected} multi={multi} onPick={pick} wrap={wrap} />
    </View>
  );
}

const optionLabel = (filter, o) => (o.value && filter.unitLabel ? `${o.label} ${filter.unitLabel}` : o.label);
const a11yFor = (filter, o, on, multi) => ({
  accessibilityRole: multi ? "checkbox" : "radio",
  accessibilityState: { checked: on },
  accessibilityLabel: `${filter.label}: ${optionLabel(filter, o)}`,
});

// "+ Label" / "✓ Label" pills. Two options share the row equally (like a segmented choice).
export function Pill({ label, on, onPress, flex, plain, a11y }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, on && styles.pillOn, flex && { flex: 1 }, pressed && { opacity: 0.75 }]} {...a11y}>
      {plain ? null : <Ionicons name={on ? "checkmark" : "add"} size={16} color={on ? brand.violet : colors.muted} />}
      <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Pills({ filter, selected, multi, onPick, wrap }) {
  const fill = filter.options.length <= 2 && !wrap;
  const Wrap = fill || wrap ? View : ScrollView;
  const wrapProps = wrap
    ? { style: styles.wrapRow }
    : fill
      ? { style: styles.fillRow }
      : { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.scrollRow };
  return (
    <Wrap {...wrapProps}>
      {filter.options.map((o) => {
        const on = selected.includes(o.value);
        return <Pill key={o.value || "any"} label={optionLabel(filter, o)} on={on} flex={fill} onPress={() => onPick(o.value)} a11y={a11yFor(filter, o, on, multi)} />;
      })}
    </Wrap>
  );
}

function Segmented({ filter, selected, multi, onPick }) {
  return (
    <View style={styles.fillRow}>
      {filter.options.map((o) => {
        const on = selected.includes(o.value);
        return <Pill key={o.value || "any"} plain flex label={o.label} on={on} onPress={() => onPick(o.value)} a11y={a11yFor(filter, o, on, multi)} />;
      })}
    </View>
  );
}

function Tiles({ filter, selected, multi, onPick, wrap }) {
  const Wrap = wrap ? View : ScrollView;
  const wrapProps = wrap ? { style: styles.wrapRow } : { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.scrollRow };
  return (
    <Wrap {...wrapProps}>
      {filter.options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable key={o.value} onPress={() => onPick(o.value)} style={({ pressed }) => [styles.tile, wrap && styles.tileWrap, on && styles.tileOn, pressed && { opacity: 0.8 }]} {...a11yFor(filter, o, on, multi)}>
            {on ? <Ionicons name="checkmark" size={15} color={brand.violet} style={styles.tileCheck} /> : null}
            <Ionicons name={o.icon || "home-outline"} size={30} color={on ? brand.violet : colors.ink} />
            <Text style={[styles.tileText, on && { color: brand.deep }]} numberOfLines={2}>{o.label}</Text>
          </Pressable>
        );
      })}
    </Wrap>
  );
}

function Checkboxes({ filter, selected, multi, onPick, wrap }) {
  const [open, setOpen] = useState(false);
  const limit = filter.collapsedCount || filter.options.length;
  // Never hide a ticked option behind "+ more".
  const hiddenOn = filter.options.slice(limit).some((o) => selected.includes(o.value));
  const shown = open || hiddenOn ? filter.options : filter.options.slice(0, limit);
  const more = filter.options.length - shown.length;
  return (
    <View>
      <View style={styles.grid}>
        {shown.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Pressable key={o.value} onPress={() => onPick(o.value)} style={[styles.check, wrap && styles.checkFull]} {...a11yFor(filter, o, on, multi)}>
              <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}</View>
              <Text style={styles.checkText} numberOfLines={2}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {more > 0 ? (
        <Pressable onPress={() => setOpen(true)} style={styles.more} accessibilityRole="button" accessibilityLabel={`Show ${more} more ${filter.label.toLowerCase()}`}>
          <Text style={styles.moreText}>+ {more} more</Text>
        </Pressable>
      ) : open && filter.collapsedCount && !hiddenOn ? (
        <Pressable onPress={() => setOpen(false)} style={styles.more} accessibilityRole="button">
          <Text style={styles.moreText}>Show less</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// "Min ▾  to  Max ▾" + a two-thumb slider over the same steps; area ranges add a unit dropdown.
function RangeSelect({ filter, value, onChange, title }) {
  // The unit lives locally too: a unit with no bounds is not a filter, so FilterState drops it.
  const [unit, setUnit] = useState(value?.unit || filter.unit?.default);
  useEffect(() => {
    if (value?.unit) setUnit(value.unit);
  }, [value?.unit]);
  const [open, setOpen] = useState(null); // "min" | "max" | "unit"
  const steps = filter.unit ? filter.stepsByUnit[unit] : filter.steps;
  const min = value?.min ?? null;
  const max = value?.max ?? null;
  const prefix = filter.format === "inr" ? "₹ " : "";
  const bare = (n) => (filter.format === "inr" ? inrWords(n) : filter.format === "floor" ? formatStep(filter, n) : Number(n).toLocaleString("en-IN"));
  const fmt = (n) => `${prefix}${bare(n)}`;
  const emit = (patch) => onChange({ min, max, unit, ...patch });

  const list =
    open === "unit"
      ? filter.unit.options.map((o) => ({ key: o.value, label: o.label, on: o.value === unit, pick: () => { setUnit(o.value); onChange({ min: null, max: null, unit: o.value }); } }))
      : open === "min"
        ? [{ key: "none", label: "No min", on: min == null, pick: () => emit({ min: null }) }, ...steps.filter((s) => max == null || s < max).map((s) => ({ key: s, label: fmt(s), on: s === min, pick: () => emit({ min: s }) }))]
        : open === "max"
          ? [{ key: "none", label: "No max", on: max == null, pick: () => emit({ max: null }) }, ...steps.filter((s) => min == null || s > min).map((s) => ({ key: s, label: fmt(s), on: s === max, pick: () => emit({ max: s }) }))]
          : [];

  return (
    <View>
      <View style={styles.rangeHead}>
        {title ? <Text style={[styles.title, { marginBottom: 0, flex: 1 }]} accessibilityRole="header">{filter.label}</Text> : <View style={{ flex: 1 }} />}
        {filter.unit ? (
          <Pressable onPress={() => setOpen(open === "unit" ? null : "unit")} style={styles.unit} accessibilityRole="button" accessibilityLabel={`Unit: ${unitLabel(filter, unit)}`} accessibilityState={{ expanded: open === "unit" }}>
            <Text style={styles.unitText}>{unitLabel(filter, unit)}</Text>
            <Ionicons name="caret-down" size={14} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.selects}>
        <Select label={min == null ? `${prefix}Min` : fmt(min)} set={min != null} open={open === "min"} onPress={() => setOpen(open === "min" ? null : "min")} a11y={`Minimum ${filter.label.toLowerCase()}`} />
        <Text style={styles.to}>to</Text>
        <Select label={max == null ? `${prefix}Max` : fmt(max)} set={max != null} open={open === "max"} onPress={() => setOpen(open === "max" ? null : "max")} a11y={`Maximum ${filter.label.toLowerCase()}`} />
      </View>
      {open ? (
        <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {list.map((it) => (
            <Pressable key={it.key} onPress={() => { it.pick(); setOpen(null); }} style={[styles.listRow, it.on && styles.listRowOn]} accessibilityRole="radio" accessibilityState={{ checked: it.on }}>
              <Text style={[styles.listText, it.on && { color: brand.deep, fontWeight: "800" }]}>{it.label}</Text>
              {it.on ? <Ionicons name="checkmark" size={17} color={brand.violet} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <DualSlider
        steps={steps}
        minIndex={minToIndex(steps, min)}
        maxIndex={maxToIndex(steps, max)}
        format={fmt}
        label={filter.label.toLowerCase()}
        onChange={(lo, hi) => emit({ min: lo < 0 ? null : steps[lo], max: hi >= steps.length ? null : steps[hi] })}
      />
    </View>
  );
}

// 5000000 -> "50 Lac", 15000000 -> "1.5 Cr", 15000 -> "15K"
const trim = (x) => String(+x.toFixed(2));
export function inrWords(n) {
  if (n >= 10000000) return `${trim(n / 10000000)} Cr`;
  if (n >= 100000) return `${trim(n / 100000)} Lac`;
  if (n >= 1000) return `${trim(n / 1000)}K`;
  return String(n);
}

function Select({ label, set, open, onPress, a11y }) {
  return (
    <Pressable onPress={onPress} style={[styles.select, open && styles.selectOpen]} accessibilityRole="button" accessibilityLabel={`${a11y}: ${label}`} accessibilityState={{ expanded: open }}>
      <Text style={[styles.selectText, !set && { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  scrollRow: { gap: 10, paddingRight: 8 },
  fillRow: { flexDirection: "row", gap: 12 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillOn: { borderColor: brand.violet, backgroundColor: brand.lavender },
  pillText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  pillTextOn: { color: brand.deep, fontWeight: "700" },
  tile: {
    width: 112,
    minHeight: 104,
    borderRadius: radius.sm,
    borderWidth: 1.2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 8,
  },
  tileWrap: { width: "47%", minHeight: 96 },
  tileOn: { borderColor: brand.violet, backgroundColor: brand.lavender },
  tileCheck: { position: "absolute", top: 6, right: 8 },
  tileText: { fontSize: 13, color: colors.ink, textAlign: "center", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  check: { width: "50%", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 8 },
  checkFull: { width: "100%" },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: "#C9C2DB", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: brand.violet, borderColor: brand.violet },
  checkText: { fontSize: 14.5, color: colors.text, flex: 1 },
  more: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  moreText: { fontSize: 15, fontWeight: "800", color: brand.violet },
  rangeHead: { flexDirection: "row", alignItems: "center", marginBottom: 12, minHeight: 28 },
  unit: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, minWidth: 90, justifyContent: "flex-end" },
  unitText: { fontSize: 14.5, color: colors.ink, fontWeight: "600" },
  selects: { flexDirection: "row", alignItems: "center", gap: 12 },
  select: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1.2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectOpen: { borderColor: brand.violet },
  selectText: { fontSize: 15, color: colors.ink, fontWeight: "600", flex: 1 },
  to: { fontSize: 14, color: colors.muted },
  list: { maxHeight: 220, marginTop: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  listRow: { minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listRowOn: { backgroundColor: brand.lavender },
  listText: { fontSize: 14.5, color: colors.text },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 },
  toggleText: { fontSize: 15, fontWeight: "700", color: colors.ink, flex: 1, marginRight: 12 },
});
