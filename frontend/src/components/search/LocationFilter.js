import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { getCurrentUserLocation } from "../../services/locationService";
import { brand, colors, radius } from "../../theme";
import Text, { AppTextInput as TextInput } from "../AppText";

// City / locality picker. Suggestions are real locality + city pairs from /properties/locations
// (most listings first); picking one sets both. "Use my current location" does the same from GPS.
export default function LocationFilter({ city, locality, onChange }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .locations({ search: text.trim(), limit: 20 })
        .then((r) => alive && setItems(r?.locations || []))
        .catch(() => alive && setItems([]))
        .finally(() => alive && setLoading(false));
    }, text ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text]);

  const locate = async () => {
    setLocating(true);
    setNote("");
    try {
      const facets = await api.facets().catch(() => ({ cities: [] }));
      const r = await getCurrentUserLocation(facets.cities || [], true);
      if (r?.city) onChange({ city: r.city, locality: r.locality || "" });
      else setNote("Couldn't detect your location. Pick a city instead.");
    } catch {
      setNote("Couldn't detect your location. Pick a city instead.");
    } finally {
      setLocating(false);
    }
  };

  const chips = [locality && { key: "locality", label: locality }, city && { key: "city", label: city }].filter(Boolean);
  const isPicked = (l) => (l.city || "") === city && (l.locality || "") === locality;

  return (
    <View>
      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <Pressable key={c.key} onPress={() => onChange({ [c.key]: "" })} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Remove ${c.label}`}>
              <Ionicons name="location" size={13} color={brand.deep} />
              <Text style={styles.chipText} numberOfLines={1}>{c.label}</Text>
              <Ionicons name="close" size={14} color={brand.deep} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a city or locality"
          placeholderTextColor={brand.placeholder}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Type a city or locality"
        />
      </View>

      <Pressable onPress={locate} disabled={locating} style={styles.locate} accessibilityRole="button" accessibilityLabel="Use my current location">
        {locating ? <ActivityIndicator size="small" color={brand.violet} /> : <Ionicons name="locate" size={18} color={brand.violet} />}
        <Text style={styles.locateText}>Use my current location</Text>
      </Pressable>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <Text style={styles.section}>{text.trim() ? "Matching locations" : "Popular locations"}</Text>
      {items == null || (loading && !items.length) ? (
        <ActivityIndicator color={brand.violet} style={{ marginVertical: 16 }} />
      ) : items.length ? (
        items.map((l) => {
          const on = isPicked(l);
          return (
            <Pressable
              key={`${l.locality}|${l.city}`}
              onPress={() => onChange(on ? { city: "", locality: "" } : { city: l.city || "", locality: l.locality || "" })}
              style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.7 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={l.formatted}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, on && { color: brand.deep }]} numberOfLines={1}>{l.locality || l.city}</Text>
                {l.locality && l.city ? <Text style={styles.rowSub} numberOfLines={1}>{l.city}</Text> : null}
              </View>
              {on ? <Ionicons name="checkmark-circle" size={20} color={brand.violet} /> : l.count ? <Text style={styles.count}>{l.count}</Text> : null}
            </Pressable>
          );
        })
      ) : (
        <Text style={styles.note}>No locations match "{text.trim()}".</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34, maxWidth: "100%", paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: brand.lavender },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: brand.deep },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.2, borderColor: colors.line, backgroundColor: colors.white },
  input: { flex: 1, fontSize: 14.5, color: colors.ink, paddingVertical: 10 },
  locate: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  locateText: { fontSize: 14.5, fontWeight: "700", color: brand.violet },
  note: { fontSize: 13, color: colors.muted, marginVertical: 6 },
  section: { fontSize: 12, fontWeight: "800", color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 8, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 10, borderRadius: radius.sm },
  rowOn: { backgroundColor: brand.lavender },
  rowTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 1 },
  count: { fontSize: 12, fontWeight: "700", color: colors.muted },
});
