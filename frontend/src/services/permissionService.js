import { Linking, PermissionsAndroid, Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Normalised permission states used by the onboarding UI:
//   granted      – OS has granted access
//   undetermined – never asked; a system prompt can be shown
//   denied       – refused once, but the OS will still show the prompt again
//   blocked      – refused permanently / restricted; only the Settings app can change it
//   unavailable  – not supported in this build or platform
const NOTIF_KEY = "cp_perm_notifications";
const LOCATION_KEY = "cp_perm_location";

function fromExpo({ status, canAskAgain }) {
  if (status === "granted") return "granted";
  if (status === "undetermined") return "undetermined";
  return canAskAgain === false ? "blocked" : "denied";
}

export async function getLocationStatus() {
  try {
    return fromExpo(await Location.getForegroundPermissionsAsync());
  } catch {
    return "unavailable";
  }
}

export async function requestLocation() {
  const before = await getLocationStatus();
  if (before === "granted" || before === "blocked" || before === "unavailable") return before;
  try {
    const result = fromExpo(await Location.requestForegroundPermissionsAsync());
    await AsyncStorage.setItem(LOCATION_KEY, result).catch(() => {});
    return result;
  } catch {
    return "unavailable";
  }
}

// Location is only usable when the app has permission AND the device's location switch is on.
// "off" means permission is granted but the switch is off.
async function servicesOn() {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

export async function getLocationAccess() {
  const status = await getLocationStatus();
  if (status !== "granted") return status;
  return (await servicesOn()) ? "granted" : "off";
}

// Asks for whatever is missing: the OS permission prompt if it can still be shown, then (on
// Android) the system "turn on location" dialog if the switch is off.
export async function requestLocationAccess() {
  const status = await requestLocation();
  if (status !== "granted") return status;
  if (await servicesOn()) return "granted";
  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // user declined the dialog
    }
  }
  return (await servicesOn()) ? "granted" : "off";
}

// The device's location settings page (Android); iOS can only open this app's settings.
export function openLocationSettings() {
  if (Platform.OS === "android") {
    return Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(openAppSettings);
  }
  return openAppSettings();
}

// Android 13+ is the only platform where this build can show a notification prompt.
// Android 12 and below deliver notifications without a runtime permission. iOS needs
// expo-notifications, which this app does not include yet, so it is reported as unavailable
// rather than pretending to be granted.
const androidRuntime = Platform.OS === "android" && Platform.Version >= 33;

export async function getNotificationStatus() {
  if (Platform.OS === "android" && !androidRuntime) return "granted";
  if (!androidRuntime) return "unavailable";
  try {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (granted) return "granted";
    const stored = await AsyncStorage.getItem(NOTIF_KEY).catch(() => null);
    return stored === "blocked" || stored === "denied" ? stored : "undetermined";
  } catch {
    return "unavailable";
  }
}

export async function requestNotifications() {
  const before = await getNotificationStatus();
  if (before !== "undetermined" && before !== "denied") return before;
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    const result =
      r === PermissionsAndroid.RESULTS.GRANTED
        ? "granted"
        : r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          ? "blocked"
          : "denied";
    await AsyncStorage.setItem(NOTIF_KEY, result).catch(() => {});
    return result;
  } catch {
    return "unavailable";
  }
}

export function openAppSettings() {
  return Linking.openSettings().catch(() => {});
}
