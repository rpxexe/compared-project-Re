import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Button from "../components/Button";
import ChoiceDropdown from "../components/ChoiceDropdown";
import { CATEGORY_OPTIONS, LISTING_OPTIONS } from "../utils/postPropertyFlow";
import { colors, fonts, glow, radius, shadow } from "../theme";
import { useAuth } from "../context/AuthContext";

// Post Property tab = the two selection steps. The form itself lives in PostPropertyFormScreen
// and receives the choices as route params, so they are never asked twice.
export default function PostPropertyScreen({ navigation }) {
  const { token, openLoginPrompt } = useAuth();
  const [listingType, setListingType] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState("");
  const ready = !!listingType && !!category;

  const chooseListing = (v) => {
    setListingType(v);
    setOpen(category ? "" : "category"); // guide the user straight to the next question
  };
  const chooseCategory = (v) => {
    setCategory(v);
    setOpen("");
  };
  const next = () => {
    if (!token) {
      openLoginPrompt({
        reason: "post_property",
        title: "Sign In to List Property",
        message: "Please sign in or register to complete your property listing.",
      });
      return;
    }
    navigation.navigate("PostPropertyForm", { listingType, category });
  };

  return (
    <Screen keyboard>
      <View style={styles.wrap}>
        <LinearGradient colors={["#3B1A8A", colors.plum, colors.ink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.halo} />
          <Text style={styles.eyebrow}>COMPAREPROJECTS</Text>
          <Text style={styles.title}>Post your property</Text>
          <Text style={styles.sub}>Two quick choices and we'll tailor the form to your listing.</Text>
        </LinearGradient>

        <View style={styles.steps}>
          {[["1", "Purpose", !!listingType], ["2", "Property type", !!category], ["3", "Details", false]].map(([n, l, done], i) => (
            <View key={n} style={styles.stepItem}>
              <View style={[styles.dot, done && styles.dotDone]}>
                {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={styles.dotText}>{n}</Text>}
              </View>
              <Text style={[styles.stepLabel, done && { color: colors.ink }]}>{l}</Text>
              {i < 2 ? <View style={[styles.line, done && { backgroundColor: colors.violet }]} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <ChoiceDropdown
            label="STEP 1 · I WANT TO"
            placeholder="Select Rent or Resale"
            value={listingType}
            options={LISTING_OPTIONS}
            open={open === "listing"}
            onToggle={() => setOpen(open === "listing" ? "" : "listing")}
            onSelect={chooseListing}
            icon="swap-horizontal"
          />
          {listingType ? (
            <View style={{ marginTop: 18 }}>
              <ChoiceDropdown
                label="STEP 2 · PROPERTY CATEGORY"
                placeholder="Select Residential or Commercial"
                value={category}
                options={CATEGORY_OPTIONS}
                open={open === "category"}
                onToggle={() => setOpen(open === "category" ? "" : "category")}
                onSelect={chooseCategory}
                icon="business-outline"
              />
            </View>
          ) : null}
          <Button title="Continue" icon="arrow-forward" disabled={!ready} onPress={next} style={{ marginTop: 22 }} />
          {!ready ? <Text style={styles.hint}>{listingType ? "Choose a category to continue." : "Choose Rent or Resale to begin."}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 30 },
  hero: { borderRadius: radius.xl, padding: 22, overflow: "hidden", ...glow },
  halo: { position: "absolute", right: -50, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(166,107,255,0.28)" },
  eyebrow: { color: colors.neon, fontSize: 10.5, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#fff", fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, marginTop: 6 },
  sub: { color: "#D2C5EE", fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  steps: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 16 },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.violet, borderColor: colors.violet },
  dotText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  stepLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginLeft: 6 },
  line: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.line, marginHorizontal: 6 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: "#E6DEF7", ...shadow.card },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 10 },
});
