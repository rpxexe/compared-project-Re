import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import Button from "../components/Button";
import { getLocationAccess, openAppSettings, openLocationSettings, requestLocationAccess } from "../services/permissionService";
import { brand } from "../theme";
import Text from "../components/AppText";

// "Not now" on the launch prompt keeps it quiet for a few days; asking from a feature
// (e.g. "Use current location") always shows it.
const SNOOZE_KEY = "cp_location_prompt_snoozed_at";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_REASON = "We use your location to show properties near you and fill in your city and locality for you.";

const COPY = {
  undetermined: { icon: "location", title: "Allow location access", action: "Allow location" },
  denied: { icon: "location", title: "Allow location access", action: "Allow location" },
  blocked: {
    icon: "lock-closed",
    title: "Location permission is off",
    action: "Open settings",
    note: Platform.OS === "ios" ? "Settings → CompareProjects → Location → While Using the App" : "Settings → Permissions → Location → Allow while using the app",
  },
  off: { icon: "navigate-circle", title: "Turn on your location", action: "Turn on location", note: "Your phone's location (GPS) is switched off." },
  unavailable: { icon: "alert-circle", title: "Location isn't available", action: "OK", note: "This device can't share its location right now." },
};

const LocationAccessContext = createContext({ ensureLocation: async () => false, promptOnLaunch: async () => false });
export const useLocationAccess = () => useContext(LocationAccessContext);

export function LocationAccessProvider({ children }) {
  const [sheet, setSheet] = useState(null); // { status, reason }
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);
  const waitingForSettings = useRef(false);
  const launchAsked = useRef(false);

  const finish = useCallback((granted) => {
    resolver.current?.(granted);
    resolver.current = null;
    waitingForSettings.current = false;
    setSheet(null);
  }, []);

  const openSheet = useCallback((status, reason) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setSheet({ status, reason: reason || DEFAULT_REASON });
  }), []);

  // Back from the Settings app: pick up a permission or GPS switch the user just turned on.
  useEffect(() => {
    if (!sheet) return undefined;
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !waitingForSettings.current) return;
      waitingForSettings.current = false;
      const status = await getLocationAccess();
      if (status === "granted") finish(true);
      else setSheet((s) => (s ? { ...s, status } : s));
    });
    return () => sub.remove();
  }, [sheet, finish]);

  // Ask from a feature that needs location right now. Shows the OS prompt directly when it
  // still can, and the explainer sheet when access is denied, blocked or switched off.
  const ensureLocation = useCallback(async (reason) => {
    const status = await requestLocationAccess();
    if (status === "granted") return true;
    return openSheet(status, reason);
  }, [openSheet]);

  // Once per app session, after onboarding: remind users who haven't enabled location.
  const promptOnLaunch = useCallback(async () => {
    if (launchAsked.current) return false;
    launchAsked.current = true;
    const status = await getLocationAccess();
    if (status === "granted" || status === "unavailable") return false;
    const snoozedAt = Number(await AsyncStorage.getItem(SNOOZE_KEY).catch(() => 0)) || 0;
    if (Date.now() - snoozedAt < SNOOZE_MS) return false;
    const granted = await openSheet(status);
    if (!granted) AsyncStorage.setItem(SNOOZE_KEY, String(Date.now())).catch(() => {});
    return granted;
  }, [openSheet]);

  const primary = async () => {
    if (!sheet || busy) return;
    const { status } = sheet;
    if (status === "unavailable") return finish(false);
    if (status === "blocked") {
      waitingForSettings.current = true;
      return openAppSettings();
    }
    setBusy(true);
    try {
      const next = await requestLocationAccess();
      if (next === "granted") return finish(true);
      if (next === "off" && status === "off") {
        // The system dialog was declined or isn't available: send them to the location page.
        waitingForSettings.current = true;
        openLocationSettings();
      }
      setSheet((s) => (s ? { ...s, status: next } : s));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ ensureLocation, promptOnLaunch }), [ensureLocation, promptOnLaunch]);
  const copy = sheet ? COPY[sheet.status] || COPY.denied : null;

  return (
    <LocationAccessContext.Provider value={value}>
      {children}
      <BottomSheet visible={!!sheet} onClose={() => finish(false)} title="">
        {copy ? (
          <View style={styles.body}>
            <View style={styles.iconRing}>
              <View style={styles.icon}>
                <Ionicons name={copy.icon} size={30} color="#fff" />
              </View>
            </View>
            <Text style={styles.title} accessibilityRole="header">{copy.title}</Text>
            <Text style={styles.reason}>{sheet.reason}</Text>
            {copy.note ? (
              <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={16} color={brand.violet} />
                <Text style={styles.noteText}>{copy.note}</Text>
              </View>
            ) : null}
            <Button title={copy.action} icon={sheet.status === "blocked" ? "settings-outline" : "navigate"} loading={busy} onPress={primary} style={styles.cta} />
            {sheet.status !== "unavailable" ? (
              <Button title="Not now" variant="ghost" onPress={() => finish(false)} style={styles.later} />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </LocationAccessContext.Provider>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", paddingBottom: 4 },
  iconRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  icon: { width: 62, height: 62, borderRadius: 31, backgroundColor: brand.violet, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: brand.ink, marginTop: 16, textAlign: "center" },
  reason: { fontSize: 14, lineHeight: 21, color: brand.inkSoft, marginTop: 8, textAlign: "center", paddingHorizontal: 8 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: brand.lavender, alignSelf: "stretch" },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: brand.ink, fontWeight: "600" },
  cta: { alignSelf: "stretch", marginTop: 20 },
  later: { alignSelf: "stretch", marginTop: 10 },
});
