import React from "react";
import { StyleSheet, View } from "react-native";
import Button from "../Button";

// "Clear" + "Show N results". The count comes from useLiveCount on the *staged* filters.
export const resultsLabel = ({ count, loading, error }) => {
  if (error) return "Show results";
  if (count == null || loading) return "Counting…";
  if (count === 0) return "No results";
  return `Show ${count.toLocaleString("en-IN")} result${count === 1 ? "" : "s"}`;
};

export default function ApplyBar({ live, onClear, onApply, clearLabel = "Clear all", clearDisabled, style }) {
  const label = resultsLabel(live);
  return (
    <View style={[styles.bar, style]}>
      <Button title={clearLabel} variant="ghost" style={{ flex: 1 }} onPress={onClear} disabled={clearDisabled} accessibilityLabel={clearLabel} />
      <Button
        title={label}
        style={{ flex: 2 }}
        onPress={onApply}
        accessibilityLabel={label === "Counting…" ? "Show results, counting matches" : label}
        accessibilityHint="Applies the filters and closes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 12, paddingTop: 12 },
});
