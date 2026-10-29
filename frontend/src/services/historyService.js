import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "cp_search_history";
const VIEW_HISTORY_KEY = "cp_view_history";
const MAX_SEARCH_HISTORY = 10;
const MAX_VIEW_HISTORY = 15;

const historyListeners = new Set();

function notifyListeners(history) {
  historyListeners.forEach((fn) => {
    try {
      fn(history);
    } catch (e) {
      console.log("[historyService] listener error:", e);
    }
  });
}

/**
 * Subscribe to search history changes
 */
export function subscribeSearchHistory(listener) {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

/**
 * Get saved search history
 */
export async function getSearchHistory() {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.log("[historyService] Error loading search history:", err?.message);
    return [];
  }
}

/**
 * Add an item to search history
 * @param {Object} item - { query, city, locality, propertyType, bhk }
 */
export async function addSearchHistory(item) {
  if (!item) return [];
  const query = (item.query || item.search || "").trim();
  const city = (item.city || "").trim();
  const locality = (item.locality || "").trim();
  const propertyType = (item.propertyType || "").trim();
  const bhk = (item.bhk || "").trim();

  // If completely empty, skip
  if (!query && !city && !locality && !propertyType && !bhk) return [];

  try {
    const existing = await getSearchHistory();
    // Check duplicate by label
    const label = [query, locality, city, propertyType, bhk ? `${bhk} BHK` : ""]
      .filter(Boolean)
      .join(" · ");

    const filtered = existing.filter((it) => {
      const itLabel = [it.query, it.locality, it.city, it.propertyType, it.bhk ? `${it.bhk} BHK` : ""]
        .filter(Boolean)
        .join(" · ");
      return itLabel.toLowerCase() !== label.toLowerCase();
    });

    const newItem = {
      id: `sh_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      query,
      city,
      locality,
      propertyType,
      bhk,
      label: label || query || city || "Recent Search",
      timestamp: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    notifyListeners(updated);
    return updated;
  } catch (err) {
    console.log("[historyService] Error saving search history:", err?.message);
    return [];
  }
}

/**
 * Remove a specific search history item
 */
export async function removeSearchHistory(id) {
  try {
    const existing = await getSearchHistory();
    const updated = existing.filter((item) => item.id !== id);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    notifyListeners(updated);
    return updated;
  } catch (err) {
    console.log("[historyService] Error removing search history:", err?.message);
    return [];
  }
}

/**
 * Clear all search history
 */
export async function clearSearchHistory() {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    notifyListeners([]);
    return [];
  } catch (err) {
    console.log("[historyService] Error clearing search history:", err?.message);
    return [];
  }
}

/**
 * Record a property view
 */
export async function recordPropertyView(property) {
  if (!property || !property.id) return;
  try {
    const raw = await AsyncStorage.getItem(VIEW_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((p) => p.id !== property.id);
    const item = {
      id: property.id,
      title: property.title,
      city: property.city,
      locality: property.locality,
      propertyType: property.propertyType,
      bhk: property.bhk,
      price: property.price,
      viewedAt: Date.now(),
    };
    const updated = [item, ...filtered].slice(0, MAX_VIEW_HISTORY);
    await AsyncStorage.setItem(VIEW_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.log("[historyService] Error recording property view:", err?.message);
  }
}

/**
 * Get user preferences derived from search & view history
 */
export async function getUserPreferences() {
  try {
    const [searches, viewsRaw] = await Promise.all([
      getSearchHistory(),
      AsyncStorage.getItem(VIEW_HISTORY_KEY),
    ]);
    const views = viewsRaw ? JSON.parse(viewsRaw) : [];

    // Find most frequent city
    const cityCounts = {};
    const typeCounts = {};

    searches.forEach((s) => {
      if (s.city) cityCounts[s.city] = (cityCounts[s.city] || 0) + 2;
      if (s.propertyType) typeCounts[s.propertyType] = (typeCounts[s.propertyType] || 0) + 2;
    });

    views.forEach((v) => {
      if (v.city) cityCounts[v.city] = (cityCounts[v.city] || 0) + 1;
      if (v.propertyType) typeCounts[v.propertyType] = (typeCounts[v.propertyType] || 0) + 1;
    });

    const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const latestSearch = searches[0] || null;

    return {
      searches,
      recentViews: views.slice(0, 5),
      preferredCity: topCity,
      preferredType: topType,
      latestSearch,
    };
  } catch (err) {
    return { searches: [], recentViews: [], preferredCity: "", preferredType: "", latestSearch: null };
  }
}
