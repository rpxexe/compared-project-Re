import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, TouchableOpacity } from "react-native";
import Text from "./AppText";

const INITIAL_DATA = [
  { id: "1", name: "John Doe", role: "Engineer", age: 28 },
  { id: "2", name: "Jane Smith", role: "Engineer", age: 34 },
  { id: "3", name: "Sam Wilson", role: "Manager", age: 41 },
];

export default function SortableTable() {
  const [data, setData] = useState(INITIAL_DATA);
  const [sortKey, setSortKey] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' or 'desc'

  // Dynamic sorting engine based on state triggers
  const sortedData = useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });
    return sorted;
  }, [data, sortKey, sortOrder]);

  const handleSort = (key) => {
    if (sortKey === key) {
      // Toggle sort direction if clicking the same column header
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new sort target and default back to ascending
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // Inline header component to handle clickable columns
  const HeaderColumn = ({ label, fieldKey }) => {
    const isSorted = sortKey === fieldKey;
    return (
      <TouchableOpacity
        style={styles.headerCell}
        onPress={() => handleSort(fieldKey)}
      >
        <Text style={styles.headerText}>{label}</Text>
        {isSorted && (
          <Text style={styles.sortIndicator}>
            {sortOrder === "asc" ? " ▲" : " ▼"}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Table Header Section */}
      <View style={styles.headerRow}>
        <HeaderColumn label="Name" fieldKey="name" />
        <HeaderColumn label="Role" fieldKey="role" />
        <HeaderColumn label="Age" fieldKey="age" />
      </View>

      {/* Table Body Content */}
      <FlatList
        data={sortedData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.cell}>{item.name}</Text>
            <Text style={styles.cell}>{item.role}</Text>
            <Text style={styles.cell}>{item.age}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48, backgroundColor: "#fff" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#ccc",
    paddingBottom: 8,
  },
  headerCell: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerText: { fontWeight: "bold", fontSize: 16, color: "#333" },
  sortIndicator: { fontSize: 12, color: "#007AFF" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 12,
  },
  cell: { flex: 1, fontSize: 14, color: "#444" },
});
