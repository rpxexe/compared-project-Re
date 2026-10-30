import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { brand, colors, radius } from "../../theme";
import Text, { AppTextInput as TextInput } from "../AppText";

const SHOWN = 40;

// One developer, picked from the names that really appear on listings (/properties/facets).
// The API matches the name loosely, so a typed name that isn't listed can still be used.
export default function DeveloperFilter({ value, onChange }) {
  const [all, setAll] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .facets()
      .then((f) => alive && setAll(Array.isArray(f?.developers) ? f.developers : []))
      .catch(() => alive && setAll([]));
    return () => {
      alive = false;
    };
  }, []);

  const typed = text.trim();
  const matches = useMemo(() => {
    const list = all || [];
    const hits = typed ? list.filter((d) => d.toLowerCase().includes(typed.toLowerCase())) : list;
    // Keep the picked developer visible at the top.
    return value ? [value, ...hits.filter((d) => d !== value)].slice(0, SHOWN) : hits.slice(0, SHOWN);
  }, [all, typed, value]);
  const exact = typed && matches.some((d) => d.toLowerCase() === typed.toLowerCase());

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search developers"
          placeholderTextColor={brand.placeholder}
          style={styles.input}
          accessibilityLabel="Search developers"
        />
      </View>

      <Option label="Any developer" on={!value} onPress={() => onChange("")} />
      {typed && !exact ? <Option label={`Use "${typed}"`} icon="add-circle-outline" on={false} onPress={() => onChange(typed)} /> : null}
      {all == null ? (
        <ActivityIndicator color={brand.violet} style={{ marginVertical: 16 }} />
      ) : (
        matches.map((d) => <Option key={d} label={d} on={d === value} onPress={() => onChange(d === value ? "" : d)} />)
      )}
      {all && !all.length ? <Text style={styles.note}>Couldn't load developers. Type a name above.</Text> : null}
    </View>
  );
}

function Option({ label, on, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.7 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon || (on ? "radio-button-on" : "radio-button-off")} size={20} color={on || icon ? brand.violet : "#C9C2DB"} />
      <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.2, borderColor: colors.line, backgroundColor: colors.white, marginBottom: 8 },
  input: { flex: 1, fontSize: 14.5, color: colors.ink, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 10, borderRadius: radius.sm },
  rowOn: { backgroundColor: brand.lavender },
  rowText: { flex: 1, fontSize: 14.5, color: colors.text },
  rowTextOn: { color: brand.deep, fontWeight: "800" },
  note: { fontSize: 13, color: colors.muted, marginTop: 8 },
});
