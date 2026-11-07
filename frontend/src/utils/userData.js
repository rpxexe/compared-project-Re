// Which locally stored keys belong to the signed-in person (and must go on sign-out) versus the
// device (onboarding seen, permission prompts answered). Every app key starts with "cp_"; anything
// new is treated as personal unless it is listed here, so a forgotten key fails safe.
export const USER_DATA_PREFIX = "cp_";

export const DEVICE_KEYS = [
  "cp_has_started", // the Get Started screen was seen on this device
  "cp_perm_notifications", // answers to OS permission prompts
  "cp_perm_location",
  "cp_location_prompt_snoozed_at",
];

// The user-specific keys among `keys` (e.g. AsyncStorage.getAllKeys()): search/compare
// history, compare list, recent and exact locations, filters, onboarding intent, session...
export function userDataKeys(keys) {
  return (Array.isArray(keys) ? keys : []).filter(
    (k) => typeof k === "string" && k.startsWith(USER_DATA_PREFIX) && !DEVICE_KEYS.includes(k),
  );
}
