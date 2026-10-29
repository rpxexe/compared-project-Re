import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logo from "../components/Logo";
import Button from "../components/Button";
import GlassView from "../components/GlassView";
import OnboardingBackdrop from "../components/OnboardingBackdrop";
import PressableScale from "../components/PressableScale";
import Toggle from "../components/Toggle";
import { useEntrance } from "../hooks/useEntrance";
import {
  getLocationStatus,
  getNotificationStatus,
  openAppSettings,
  requestLocation,
  requestNotifications,
} from "../services/permissionService";
import { brand, fonts, gradients, radius } from "../theme";

const STATUS_NOTE = {
  blocked: "Turned off in system settings. Tap the switch to open Settings.",
  unavailable: "Not available on this device yet.",
};

function PermissionCard({ icon, iconTone, title, body, status, onToggle, style }) {
  const on = status === "granted";
  const gold = iconTone === "gold";
  const note = STATUS_NOTE[status];
  return (
    <Animated.View style={style}>
      <View style={styles.permCard}>
        <LinearGradient
          colors={gold ? gradients.iconGold : gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.permIcon}
        >
          <Ionicons name={icon} size={24} color={gold ? "#8A5A00" : "#FFFFFF"} />
        </LinearGradient>
        <View style={styles.permText}>
          <Text style={styles.permTitle}>{title}</Text>
          <Text style={styles.permBody}>{body}</Text>
          {note ? <Text style={styles.permNote}>{note}</Text> : null}
        </View>
        <Toggle
          value={on}
          onPress={onToggle}
          disabled={status === "unavailable"}
          accessibilityLabel={title.replace("?", "")}
          accessibilityHint={
            on || status === "blocked"
              ? "Opens system settings to manage this permission"
              : "Shows the system permission prompt"
          }
        />
      </View>
    </Animated.View>
  );
}

export default function GetStartedScreen({ navigation, onComplete }) {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState("undetermined");
  const [notifications, setNotifications] = useState("undetermined");
  const [busy, setBusy] = useState(false);
  const leaving = useRef(false);

  const heroAnim = useEntrance(80, 20);
  const card1Anim = useEntrance(200, 18);
  const card2Anim = useEntrance(300, 18);
  const ctaAnim = useEntrance(400, 14);

  const refresh = useCallback(async () => {
    const [l, n] = await Promise.all([getLocationStatus(), getNotificationStatus()]);
    setLocation(l);
    setNotifications(n);
  }, []);

  // Read real OS state on mount and whenever the user returns from the Settings app.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  const finish = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    await AsyncStorage.setItem("cp_has_started", "true").catch(() => {});
    if (onComplete) onComplete();
    else navigation.navigate("Login");
    // Allow leaving again if the user comes back to this screen.
    setTimeout(() => (leaving.current = false), 600);
  }, [navigation, onComplete]);

  const toggleLocation = async () => {
    if (location === "granted" || location === "blocked") return openAppSettings();
    setLocation(await requestLocation());
  };

  const toggleNotifications = async () => {
    if (notifications === "granted" || notifications === "blocked") return openAppSettings();
    setNotifications(await requestNotifications());
  };

  const askable = (s) => s === "undetermined" || s === "denied";
  const anythingToAsk = askable(location) || askable(notifications);

  // Prompts only for permissions the OS will still ask about, one after the other, then continues.
  const allowAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (askable(location)) setLocation(await requestLocation());
      if (askable(notifications)) setNotifications(await requestNotifications());
    } finally {
      setBusy(false);
    }
    finish();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <OnboardingBackdrop imageHeight={360} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo tone="dark" size={30} wordSize={16} />
          <PressableScale
            onPress={finish}
            hitSlop={12}
            style={styles.skip}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            accessibilityHint="Continues without asking for permissions"
          >
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="arrow-forward" size={16} color={brand.violet} />
          </PressableScale>
        </View>

        <Animated.View style={[styles.hero, heroAnim]}>
          <Text style={styles.h1} accessibilityRole="header">
            Welcome to{"\n"}Compare <Text style={styles.h1Accent}>Projects</Text>
          </Text>
          <Text style={styles.sub}>
            Buy, Sell or Invest in the best properties with trusted professionals.
          </Text>
        </Animated.View>

        <GlassView level="regular" blur borderRadius={radius.xl} style={styles.panel}>
          <PermissionCard
            style={card1Anim}
            icon="location"
            title="Allow Location Access?"
            body="We use your location to show nearby properties, better recommendations and local insights."
            status={location}
            onToggle={toggleLocation}
          />
          <PermissionCard
            style={card2Anim}
            icon="notifications"
            iconTone="gold"
            title="Allow Notifications?"
            body="Get instant alerts for new properties, price changes and important updates."
            status={notifications}
            onToggle={toggleNotifications}
          />

          <Animated.View style={[styles.actions, ctaAnim]}>
            <Button
              title={anythingToAsk ? "Allow All" : "Continue"}
              iconRight="arrow-forward"
              onPress={anythingToAsk ? allowAll : finish}
              loading={busy}
              accessibilityHint={anythingToAsk ? "Asks for location and notification access, then continues" : undefined}
            />
            <Button title="Not Now" variant="glass" onPress={finish} disabled={busy} />
          </Animated.View>
        </GlassView>

        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={14} color={brand.inkSoft} />
          <Text style={styles.privacyText}>You can change these anytime in your device settings.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  skip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingLeft: 12 },
  skipText: { fontSize: 15, fontWeight: "700", color: brand.ink },
  hero: { marginTop: 56, marginBottom: 28, maxWidth: 360 },
  h1: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 44, fontWeight: "700", color: brand.ink, letterSpacing: -0.8 },
  h1Accent: { color: brand.violet },
  sub: { marginTop: 14, fontSize: 16, lineHeight: 24, color: brand.inkSoft, maxWidth: 320 },
  panel: { padding: 12, gap: 12 },
  permCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  permIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  permText: { flex: 1 },
  permTitle: { fontSize: 16.5, fontWeight: "700", color: brand.ink, marginBottom: 4 },
  permBody: { fontSize: 13.5, lineHeight: 19, color: brand.inkSoft },
  permNote: { fontSize: 12.5, lineHeight: 17, color: brand.deep, marginTop: 6, fontWeight: "600" },
  actions: { gap: 12, marginTop: 4, paddingHorizontal: 2, paddingBottom: 2 },
  privacy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  privacyText: { fontSize: 12.5, color: brand.inkSoft },
});
