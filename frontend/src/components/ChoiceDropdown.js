import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, glow, radius, shadow } from "../theme";

// Compact dropdown: a field that expands inline into a short list of options.
// options: [{ label, value, icon?, hint? }]
export default function ChoiceDropdown({ label, placeholder, value, options, open, onToggle, onSelect, icon }) {
  const selected = options.find((o) => o.value === value);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : placeholder}`}
        accessibilityState={{ expanded: !!open }}
        style={[styles.field, open && styles.fieldOpen, selected && styles.fieldDone, open && glow]}
      >
        <View style={styles.iconTile}>
          <Ionicons name={selected?.icon || icon} size={19} color={colors.goldDeep} />
        </View>
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={19} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.list}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => onSelect(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={o.label}
                style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.optIcon, on && { backgroundColor: colors.violet }]}>
                  <Ionicons name={o.icon || "ellipse-outline"} size={18} color={on ? "#fff" : colors.goldDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, on && { color: colors.ink }]}>{o.label}</Text>
                  {o.hint ? <Text style={styles.optHint}>{o.hint}</Text> : null}
                </View>
                {on ? <Ionicons name="checkmark-circle" size={21} color={colors.violet} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 8 },
  field: { minHeight: 56, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: "#FBF9FF", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  fieldOpen: { borderColor: colors.violet, backgroundColor: colors.white },
  fieldDone: { borderColor: "#B794F6" },
  iconTile: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.champagneSoft, alignItems: "center", justifyContent: "center" },
  value: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  placeholder: { color: "#8F86A8", fontWeight: "500" },
  list: { marginTop: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 6, ...shadow.card },
  option: { minHeight: 56, borderRadius: 12, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  optionOn: { backgroundColor: "#F3EEFF" },
  optIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.champagneSoft, alignItems: "center", justifyContent: "center" },
  optLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  optHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
