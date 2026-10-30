import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brand, colors, radius } from "../../theme";
import Text, { AppTextInput as TextInput } from "../AppText";

// Project name, matched against listing titles only (the top search bar also matches city,
// developer, etc.). Local text so FilterState's trimming never eats a space mid-typing.
export default function ProjectFilter({ value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (value !== text.trim()) setText(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="business-outline" size={17} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            onChange(v);
          }}
          placeholder="e.g. Bay View Residency"
          placeholderTextColor={brand.placeholder}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel="Project name"
        />
        {text ? (
          <Pressable onPress={() => { setText(""); onChange(""); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear project name">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Shows projects whose name contains this text.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.2, borderColor: colors.line, backgroundColor: colors.white },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  hint: { fontSize: 12.5, color: colors.muted, marginTop: 8 },
});
