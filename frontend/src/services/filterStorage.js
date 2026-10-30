import AsyncStorage from "@react-native-async-storage/async-storage";

// Last-used filters, one entry per search context, stored as query params (the same format as
// deep links) so a config change can never leave an unreadable blob behind: unknown keys are
// simply ignored when parsed back.
const PREFIX = "cp_filters_";
const LAST_CONTEXT_KEY = "cp_filters_context";
const INTENT_KEY = "cp_intent"; // written by IntentScreen during onboarding

export async function loadFilters(context) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + context);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveFilters(context, params) {
  try {
    await Promise.all([
      AsyncStorage.setItem(PREFIX + context, JSON.stringify(params)),
      AsyncStorage.setItem(LAST_CONTEXT_KEY, context),
    ]);
  } catch {
    // Persistence is a convenience; a failed write must never break searching.
  }
}

// Context to open with when nothing was asked for: last used, else the onboarding intent.
export async function loadDefaultContext() {
  try {
    const [last, intent] = await Promise.all([
      AsyncStorage.getItem(LAST_CONTEXT_KEY),
      AsyncStorage.getItem(INTENT_KEY),
    ]);
    return { last, intent };
  } catch {
    return { last: null, intent: null };
  }
}
