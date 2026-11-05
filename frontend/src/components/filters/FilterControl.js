import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toggle from "../Toggle";
import DualSlider, { maxToIndex, minToIndex } from "./DualSlider";
import { isReducedMotion } from "../../hooks/useReducedMotion";
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

  return <Choices filter={filter} value={value} onChange={onChange} title={title} wrap={wrap} />;
}

// Select-type filters. With `filter.groups` the options sit behind tabs (Residential /
// Commercial); picks in every tab stay selected, and each tab counts its own.
function Choices({ filter, value, onChange, title, wrap }) {
  const multi = filter.type === "multi_select";
  const selected = multi ? value || [] : [value ?? filter.default];
  const pick = (v) => onChange(multi ? (selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]) : v);
  // Opens on the tab holding the first selection.
  const [tab, setTab] = useState(() => filter.options.find((o) => selected.includes(o.value))?.group || filter.groups?.[0].id);
  const shown = filter.groups ? { ...filter, options: filter.options.filter((o) => o.group === tab) } : filter;
  const Body = { tiles: Tiles, checkbox: Checkboxes, segmented: Segmented }[filter.display] || Pills;

  // The new tab's options slide in from the side being moved towards (-1 left · 0 in place · 1 right).
  const swap = useRef(new Animated.Value(0)).current;
  const switchTab = (id) => {
    if (id === tab) return;
    const at = (g) => filter.groups.findIndex((x) => x.id === g);
    setTab(id);
    if (isReducedMotion()) return;
    swap.setValue(at(id) > at(tab) ? 1 : -1);
    Animated.timing(swap, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const slide = {
    opacity: swap.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [
      { translateX: swap.interpolate({ inputRange: [-1, 0, 1], outputRange: [-36, 0, 36] }) },
      { scale: swap.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.96, 1, 0.96] }) },
    ],
  };

  return (
    <View>
      {title ? <Text style={styles.title} accessibilityRole="header">{filter.label}</Text> : null}
      {filter.groups ? <GroupTabs filter={filter} selected={selected} value={tab} onChange={switchTab} /> : null}
      <Animated.View style={filter.groups ? slide : null}>
        <Body filter={shown} selected={selected} multi={multi} onPick={pick} wrap={wrap} />
      </Animated.View>
    </View>
  );
}

const TAB_PAD = 4; // track padding, also the gap between tabs

// Tabs on a lavender track. The white highlight springs across to the picked tab and its icon
// pops; until the track is measured the active tab paints its own highlight.
function GroupTabs({ filter, selected, value, onChange }) {
  const count = filter.groups.length;
  const index = Math.max(0, filter.groups.findIndex((g) => g.id === value));
  const [trackW, setTrackW] = useState(0);
  const tabW = trackW ? (trackW - TAB_PAD * 2 - TAB_PAD * (count - 1)) / count : 0;
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!tabW) return;
    const to = index * (tabW + TAB_PAD);
    // Jump into place the first time (and with reduced motion); spring on every switch after.
    if (!placed.current || isReducedMotion()) {
      placed.current = true;
      x.setValue(to);
    } else {
      Animated.spring(x, { toValue: to, speed: 16, bounciness: 7, useNativeDriver: true }).start();
    }
  }, [index, tabW, x]);

  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current || isReducedMotion()) {
      first.current = false;
      return;
    }
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 16, useNativeDriver: true }).start();
  }, [index, pop]);

  return (
    <View style={styles.tabs} accessibilityRole="tablist" onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      {tabW ? <Animated.View pointerEvents="none" style={[styles.tabHighlight, { width: tabW, transform: [{ translateX: x }] }]} /> : null}
      {filter.groups.map((g) => {
        const on = g.id === value;
        const n = filter.options.filter((o) => o.group === g.id && selected.includes(o.value)).length;
        return (
          <Pressable
            key={g.id}
            onPress={() => onChange(g.id)}
            style={({ pressed }) => [styles.tab, on && !tabW && styles.tabHighlightStatic, pressed && !on && { opacity: 0.7 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={n ? `${g.label}, ${n} selected` : g.label}
          >
            {g.icon ? (
              <Animated.View style={on ? { transform: [{ scale: pop }] } : null}>
                <Ionicons name={g.icon} size={15} color={on ? brand.violet : colors.muted} />
              </Animated.View>
            ) : null}
            <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{g.label}</Text>
            {n ? (
              <View style={styles.tabCount}>
                <Text style={styles.tabCountText}>{n}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
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
  // Budgets end with an open "30 Cr+" (no upper limit, like the slider's far right) instead of a
  // "No max" at the top. It stands in for the top step, so a plain "30 Cr" max isn't offered too.
  const openMax = filter.format === "inr";
  const top = steps[steps.length - 1];
  const noMax = { key: "none", label: openMax ? `${fmt(top)}+` : "No max", on: max == null, pick: () => emit({ max: null }) };

  const list =
    open === "unit"
      ? filter.unit.options.map((o) => ({ key: o.value, label: o.label, on: o.value === unit, pick: () => { setUnit(o.value); onChange({ min: null, max: null, unit: o.value }); } }))
      : open === "min"
        ? [{ key: "none", label: "No min", on: min == null, pick: () => emit({ min: null }) }, ...steps.filter((s) => max == null || s < max).map((s) => ({ key: s, label: fmt(s), on: s === min, pick: () => emit({ min: s }) }))]
        : open === "max"
          ? (() => {
              const capped = steps
                .filter((s) => (min == null || s > min) && !(openMax && s === top))
                .map((s) => ({ key: s, label: fmt(s), on: s === max, pick: () => emit({ max: s }) }));
              return openMax ? [...capped, noMax] : [noMax, ...capped];
            })()
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
        openTop={openMax}
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
  // Lavender track with the active tab as a raised white pill, like the filter sidebar's selection.
  tabs: { flexDirection: "row", gap: TAB_PAD, padding: TAB_PAD, marginBottom: 14, borderRadius: radius.md, backgroundColor: brand.lavender },
  tab: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 6, borderRadius: 12 },
  tabHighlight: {
    position: "absolute",
    top: TAB_PAD,
    bottom: TAB_PAD,
    left: TAB_PAD,
    borderRadius: 12,
    backgroundColor: colors.white,
    // Android elevation would lift it above the tab labels it sits behind, so a hairline edge there.
    ...Platform.select({
      android: { borderWidth: 1, borderColor: brand.lavenderMid },
      default: { shadowColor: brand.deep, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  tabHighlightStatic: { backgroundColor: colors.white },
  tabText: { flexShrink: 1, fontSize: 13, fontWeight: "600", color: colors.muted },
  tabTextOn: { fontWeight: "800", color: brand.deep },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: brand.violet },
  tabCountText: { fontSize: 10.5, fontWeight: "800", color: colors.white },
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
