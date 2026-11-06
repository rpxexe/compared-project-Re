import AsyncStorage from "@react-native-async-storage/async-storage";
import { userDataKeys } from "../utils/userData";
import { resetCityState } from "../hooks/useCity";
import { notifyHistoryCleared } from "./historyService";

// Removes everything the previous person left on this device: every user-specific cp_* key in
// storage, plus the in-memory copies screens are showing (location, search/compare history).
// Never throws; sign-out must always complete.
export async function clearUserData() {
  try {
    const keys = userDataKeys(await AsyncStorage.getAllKeys());
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Storage unavailable: the in-memory state below is still reset.
  }
  resetCityState();
  notifyHistoryCleared();
}
