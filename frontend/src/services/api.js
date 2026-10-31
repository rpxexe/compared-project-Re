import axios from "axios";
import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeError } from "../utils/errors";

function resolveApiUrl() {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

  // In development on mobile, detect current Metro bundle host so IP changes never break API
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    try {
      const scriptURL = NativeModules?.SourceCode?.scriptURL || "";
      if (scriptURL.includes("://")) {
        const host = scriptURL.split("://")[1]?.split(":")[0];
        if (host === "localhost" || host === "127.0.0.1") {
          // Bundle came over USB (`adb reverse`); `npm run device` forwards the API port too,
          // so this keeps working when the PC's Wi-Fi IP changes.
          return "http://localhost:5000/api";
        }
        if (host) return `http://${host}:5000/api`;
      }
    } catch {
      // fallback to envUrl
    }
  }

  return envUrl || "http://192.168.1.36:5000/api";
}

// The backend address dynamically resolves to the dev host or env
export const API_URL = resolveApiUrl();

const KEYS = { token: "cp_token", user: "cp_user" };
let memoryToken = null;
let onUnauthorized = null;

export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};
export const setToken = (t) => {
  memoryToken = t;
};

const client = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { Accept: "application/json" },
});

client.interceptors.request.use((config) => {
  if (!API_URL)
    return Promise.reject(
      Object.assign(new Error("API URL missing"), { code: "NO_API_URL" }),
    );
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error?.config?.url || "";
    // Signed-out users and expired sessions both get the sign-in dialog (see AuthContext).
    if (error?.response?.status === 401 && !url.startsWith("/auth/") && onUnauthorized)
      onUnauthorized({ hadSession: !!memoryToken });
    return Promise.reject(error);
  },
);

async function call(promise) {
  try {
    return (await promise).data;
  } catch (e) {
    const n = normalizeError(e);
    throw Object.assign(new Error(n.message), n);
  }
}
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && v !== false,
    ),
  );

// The auth token lives in the OS keystore/keychain (expo-secure-store), not plain AsyncStorage,
// which Android can include in backups. Native builds made before expo-secure-store was added
// don't have the module; they keep using AsyncStorage until rebuilt instead of crashing.
let SecureStore = null;
try {
  SecureStore = require("expo-secure-store");
} catch {
  SecureStore = null;
}
let secureAvailable = null;
async function canUseSecureStore() {
  if (secureAvailable === null) {
    try {
      secureAvailable = !!SecureStore && (await SecureStore.isAvailableAsync());
    } catch {
      secureAvailable = false;
    }
  }
  return secureAvailable;
}

const tokenStore = {
  async get() {
    if (!(await canUseSecureStore())) return AsyncStorage.getItem(KEYS.token);
    const token = await SecureStore.getItemAsync(KEYS.token);
    if (token) return token;
    // One-time move of a session saved by an older app version, so nobody gets logged out.
    const legacy = await AsyncStorage.getItem(KEYS.token);
    if (legacy) {
      await SecureStore.setItemAsync(KEYS.token, legacy);
      await AsyncStorage.removeItem(KEYS.token);
    }
    return legacy;
  },
  async set(token) {
    if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(KEYS.token, token);
      await AsyncStorage.removeItem(KEYS.token);
    } else {
      await AsyncStorage.setItem(KEYS.token, token);
    }
  },
  async clear() {
    if (await canUseSecureStore()) await SecureStore.deleteItemAsync(KEYS.token).catch(() => {});
    await AsyncStorage.removeItem(KEYS.token);
  },
};

export const session = {
  async load() {
    const [token, user] = await Promise.all([tokenStore.get(), AsyncStorage.getItem(KEYS.user)]);
    memoryToken = token || null;
    return { token: token || null, user: user ? JSON.parse(user) : null };
  },
  async save(token, user) {
    memoryToken = token;
    await Promise.all([tokenStore.set(token), AsyncStorage.setItem(KEYS.user, JSON.stringify(user))]);
  },
  async saveUser(user) {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  },
  async clear() {
    memoryToken = null;
    await Promise.all([tokenStore.clear(), AsyncStorage.removeItem(KEYS.user)]);
  },
};

export const api = {
  health: () => call(client.get("/health")),
  sendOtp: (phone) => call(client.post("/auth/send-otp", { phone })),
  verifyOtp: (phone, otp) =>
    call(client.post("/auth/verify-otp", { phone, otp })),

  me: () => call(client.get("/users/me")),
  updateMe: (patch) => call(client.patch("/users/me", patch)),
  myProperties: () => call(client.get("/users/me/properties")),
  myEnquiries: () => call(client.get("/users/me/enquiries")),
  notifications: () => call(client.get("/notifications")),
  markNotificationRead: (id) => call(client.patch(`/notifications/${id}/read`)),
  markAllNotificationsRead: () => call(client.patch("/notifications/read-all")),
  // `signal` (AbortController) lets the caller cancel a superseded search.
  properties: (params, { signal } = {}) =>
    call(client.get("/properties", { params: clean(params), signal })),
  propertyCount: (params, { signal } = {}) =>
    call(client.get("/properties/count", { params: clean(params), signal })),
  property: (id) => call(client.get(`/properties/${id}`)),
  categories: () => call(client.get("/properties/categories")),
  facets: () => call(client.get("/properties/facets")),
  insights: (city) => call(client.get("/properties/insights", { params: clean({ city }) })),
  locations: async (params = {}) => {
    try {
      const res = await call(
        client.get("/properties/locations", { params: clean(params) }),
      );
      if (res && Array.isArray(res.locations)) {
        const limit = params.limit || 15;
        const page = params.page || 1;
        if (typeof res.hasMore !== "undefined") {
          return res;
        }
        const total = res.locations.length;
        const skip = (page - 1) * limit;
        return {
          locations: res.locations.slice(skip, skip + limit),
          total,
          page,
          limit,
          hasMore: skip + limit < total,
        };
      }
    } catch {
      // fallback if backend route not reloaded yet
    }
    try {
      const limit = params.limit || 15;
      const page = params.page || 1;
      const [facetsRes, propRes] = await Promise.all([
        call(client.get("/properties/facets")).catch(() => ({})),
        call(client.get("/properties", { params: { limit: 60 } })).catch(
          () => ({ items: [] }),
        ),
      ]);
      const map = new Map();
      (propRes?.items || []).forEach((p) => {
        const loc = (p.locality || "").trim();
        const c = (p.city || "").trim();
        if (loc || c) {
          const key = [loc, c].filter(Boolean).join(", ");
          const existing = map.get(key) || {
            locality: loc,
            city: c,
            formatted: key,
            count: 0,
          };
          existing.count += 1;
          map.set(key, existing);
        }
      });
      (facetsRes?.cities || []).forEach((c) => {
        const cityTrimmed = (c || "").trim();
        if (cityTrimmed && !map.has(cityTrimmed)) {
          map.set(cityTrimmed, {
            locality: "",
            city: cityTrimmed,
            formatted: cityTrimmed,
            count: 0,
          });
        }
      });
      const all = Array.from(map.values()).sort((a, b) => b.count - a.count);
      const skip = (page - 1) * limit;
      return {
        locations: all.slice(skip, skip + limit),
        total: all.length,
        hasMore: skip + limit < all.length,
        page,
        limit,
      };
    } catch {
      return { locations: [], total: 0, hasMore: false, page: 1, limit: 15 };
    }
  },
  topRated: (limit = 8) =>
    call(client.get("/properties/top-rated", { params: { limit } })),
  compare: (ids) =>
    call(client.get("/properties/compare", { params: { ids: ids.join(",") } })),
  saved: () => call(client.get("/properties/saved/list")),
  setSaved: (id, saved) =>
    call(client.post(`/properties/${id}/save`, { saved })),

  reviews: (id, params) =>
    call(client.get(`/properties/${id}/reviews`, { params })),
  addReview: (id, rating, comment) =>
    call(client.post(`/properties/${id}/reviews`, { rating, comment })),
  deleteMyReview: (id) => call(client.delete(`/properties/${id}/reviews/mine`)),

  postProperty: (payload) => call(client.post("/post-property", payload)),
  // Gemini-written listing description from the form's details (the server holds the key).
  describeProperty: (facts) => call(client.post("/post-property/describe", facts, { timeout: 45000 })),
  // `asset` is an expo-image-picker asset; resolves to { url } of the stored image.
  uploadImage: async (asset) => {
    const type = asset.mimeType || "image/jpeg";
    const name = asset.fileName || `photo.${type.split("/")[1] || "jpg"}`;
    const form = new FormData();
    if (Platform.OS === "web") form.append("image", await (await fetch(asset.uri)).blob(), name);
    else form.append("image", { uri: asset.uri, name, type });
    return call(client.post("/uploads", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }));
  },
  enquire: (propertyId, message, name) =>
    call(client.post("/enquiries", { propertyId, message, name })),

  admin: {
    stats: () => call(client.get("/admin/stats")),
    users: (params) =>
      call(client.get("/admin/users", { params: clean(params) })),
    properties: (params) =>
      call(client.get("/admin/properties", { params: clean(params) })),
    reviewProperty: (id, body) =>
      call(client.patch(`/admin/properties/${id}`, body)),
    enquiries: (params) =>
      call(client.get("/admin/enquiries", { params: clean(params) })),
    updateEnquiry: (id, status) =>
      call(client.patch(`/admin/enquiries/${id}`, { status })),
  },
  signin: (data) => call(client.post("/auth/signin", { data })),
  signup: (data) => call(client.post("/auth/signup", { data })),
};
