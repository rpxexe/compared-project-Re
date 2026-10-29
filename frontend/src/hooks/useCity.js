import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { getCurrentUserLocation } from "../services/locationService";

const KEY = "cp_city";
const EXACT_KEY = "cp_exact_location";
const TITLE_KEY = "cp_location_title";
const CHOICE_KEY = "cp_city_choice"; // 'all' when user explicitly chooses 'All locations'

// Shared in-memory listeners so when LocationScreen updates location, HomeScreen immediately re-renders!
const listeners = new Set();
function notifyListeners(state) {
  listeners.forEach((listener) => listener(state));
}

let globalCity = "";
let globalExactLocation = "";
let globalFullAddress = "";
let globalLocationTitle = "";
let globalDetecting = false;

export function useCity(availableCities = []) {
  const [city, setCityState] = useState(globalCity);
  const [exactLocation, setExactLocationState] = useState(globalExactLocation);
  const [fullAddress, setFullAddressState] = useState(globalFullAddress);
  const [locationTitle, setLocationTitleState] = useState(globalLocationTitle);
  const [detectingLocation, setDetectingLocation] = useState(globalDetecting);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const handleUpdate = (data) => {
      if (data.city !== undefined) setCityState(data.city);
      if (data.exactLocation !== undefined) setExactLocationState(data.exactLocation);
      if (data.fullAddress !== undefined) setFullAddressState(data.fullAddress);
      if (data.locationTitle !== undefined) setLocationTitleState(data.locationTitle);
      if (data.detectingLocation !== undefined) setDetectingLocation(data.detectingLocation);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  // Fetch live current location
  const fetchCurrentLocation = useCallback(
    async (citiesToMatch = availableCities) => {
      globalDetecting = true;
      setDetectingLocation(true);
      notifyListeners({ detectingLocation: true });

      try {
        const result = await getCurrentUserLocation(citiesToMatch);
        if (result && (result.city || result.exactLocation || result.fullAddress)) {
          const newCity = result.city || "";
          const newFull = result.fullAddress || result.exactLocation || result.city || "";
          const newTitle = result.title || (newFull ? newFull.split(",")[0].trim() : newCity);

          globalCity = newCity;
          globalExactLocation = newFull;
          globalFullAddress = newFull;
          globalLocationTitle = newTitle;

          setCityState(newCity);
          setExactLocationState(newFull);
          setFullAddressState(newFull);
          setLocationTitleState(newTitle);

          await Promise.all([
            AsyncStorage.setItem(KEY, newCity),
            AsyncStorage.setItem(EXACT_KEY, newFull),
            AsyncStorage.setItem(TITLE_KEY, newTitle),
            AsyncStorage.removeItem(CHOICE_KEY),
          ]);

          notifyListeners({
            city: newCity,
            exactLocation: newFull,
            fullAddress: newFull,
            locationTitle: newTitle,
            detectingLocation: false,
          });

          return { city: newCity, exactLocation: newFull, fullAddress: newFull, locationTitle: newTitle };
        }
      } catch (err) {
        console.log("[useCity] Location auto-detect error:", err?.message);
        throw err;
      } finally {
        globalDetecting = false;
        setDetectingLocation(false);
        notifyListeners({ detectingLocation: false });
      }
      return null;
    },
    [availableCities]
  );

  useEffect(() => {
    let active = true;

    async function loadInitialLocation() {
      try {
        const [savedCity, savedExact, savedTitle, savedChoice] = await Promise.all([
          AsyncStorage.getItem(KEY),
          AsyncStorage.getItem(EXACT_KEY),
          AsyncStorage.getItem(TITLE_KEY),
          AsyncStorage.getItem(CHOICE_KEY),
        ]);

        if (!active) return;

        // If user already saved a location
        if (savedCity || savedExact) {
          const c = (savedCity || "").trim();
          const e = (savedExact || savedCity || "").trim();
          const t = (savedTitle || (e ? e.split(",")[0].trim() : c) || "").trim();

          globalCity = c;
          globalExactLocation = e;
          globalFullAddress = e;
          globalLocationTitle = t;

          setCityState(c);
          setExactLocationState(e);
          setFullAddressState(e);
          setLocationTitleState(t);
          setInitialized(true);
          return;
        }

        // If user explicitly chose "All locations"
        if (savedChoice === "all") {
          globalCity = "";
          globalExactLocation = "";
          globalFullAddress = "";
          globalLocationTitle = "";
          setCityState("");
          setExactLocationState("");
          setFullAddressState("");
          setLocationTitleState("");
          setInitialized(true);
          return;
        }

        // Neither is saved -> Auto-detect location on first launch!
        globalDetecting = true;
        setDetectingLocation(true);
        notifyListeners({ detectingLocation: true });

        try {
          // Pass requestIfMissing = false so HomeScreen NEVER shows an intrusive permission prompt on mount!
          const res = await getCurrentUserLocation(availableCities, false);
          if (active && res && (res.city || res.exactLocation || res.fullAddress)) {
            const newCity = res.city || "";
            const newFull = res.fullAddress || res.exactLocation || res.city || "";
            const newTitle = res.title || (newFull ? newFull.split(",")[0].trim() : newCity);

            globalCity = newCity;
            globalExactLocation = newFull;
            globalFullAddress = newFull;
            globalLocationTitle = newTitle;

            setCityState(newCity);
            setExactLocationState(newFull);
            setFullAddressState(newFull);
            setLocationTitleState(newTitle);

            await Promise.all([
              AsyncStorage.setItem(KEY, newCity),
              AsyncStorage.setItem(EXACT_KEY, newFull),
              AsyncStorage.setItem(TITLE_KEY, newTitle),
            ]);

            notifyListeners({
              city: newCity,
              exactLocation: newFull,
              fullAddress: newFull,
              locationTitle: newTitle,
              detectingLocation: false,
            });
          }
        } catch (e) {
          console.log("[useCity] Initial auto-fetch skipped/failed:", e?.message);
        } finally {
          if (active) {
            globalDetecting = false;
            setDetectingLocation(false);
            notifyListeners({ detectingLocation: false });
          }
        }
      } catch (err) {
        console.log("[useCity] Storage load error:", err?.message);
      } finally {
        if (active) setInitialized(true);
      }
    }

    loadInitialLocation();

    return () => {
      active = false;
    };
  }, []);

  const setCity = useCallback((c) => {
    const trimmed = (c || "").trim();
    globalCity = trimmed;
    globalExactLocation = trimmed;
    globalFullAddress = trimmed;
    globalLocationTitle = trimmed;

    setCityState(trimmed);
    setExactLocationState(trimmed);
    setFullAddressState(trimmed);
    setLocationTitleState(trimmed);

    if (trimmed) {
      AsyncStorage.setItem(KEY, trimmed).catch(() => {});
      AsyncStorage.setItem(EXACT_KEY, trimmed).catch(() => {});
      AsyncStorage.setItem(TITLE_KEY, trimmed).catch(() => {});
      AsyncStorage.removeItem(CHOICE_KEY).catch(() => {});
    } else {
      AsyncStorage.removeItem(KEY).catch(() => {});
      AsyncStorage.removeItem(EXACT_KEY).catch(() => {});
      AsyncStorage.removeItem(TITLE_KEY).catch(() => {});
      AsyncStorage.setItem(CHOICE_KEY, "all").catch(() => {});
    }
    notifyListeners({
      city: trimmed,
      exactLocation: trimmed,
      fullAddress: trimmed,
      locationTitle: trimmed,
    });
  }, []);

  const setLocation = useCallback((exactLoc, cityName, title) => {
    const trimmedExact = (exactLoc || "").trim();
    let trimmedCity = (cityName || "").trim();

    if (!trimmedCity && trimmedExact) {
      // If no city provided, extract the last comma-separated part or whole
      const parts = trimmedExact.split(",").map((p) => p.trim());
      trimmedCity = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    }

    const trimmedTitle = (title || (trimmedExact ? trimmedExact.split(",")[0].trim() : trimmedCity) || "").trim();

    globalCity = trimmedCity;
    globalExactLocation = trimmedExact;
    globalFullAddress = trimmedExact;
    globalLocationTitle = trimmedTitle;

    setCityState(trimmedCity);
    setExactLocationState(trimmedExact);
    setFullAddressState(trimmedExact);
    setLocationTitleState(trimmedTitle);

    if (trimmedExact) {
      AsyncStorage.setItem(EXACT_KEY, trimmedExact).catch(() => {});
      AsyncStorage.setItem(KEY, trimmedCity).catch(() => {});
      AsyncStorage.setItem(TITLE_KEY, trimmedTitle).catch(() => {});
      AsyncStorage.removeItem(CHOICE_KEY).catch(() => {});
    } else {
      AsyncStorage.removeItem(KEY).catch(() => {});
      AsyncStorage.removeItem(EXACT_KEY).catch(() => {});
      AsyncStorage.removeItem(TITLE_KEY).catch(() => {});
      AsyncStorage.setItem(CHOICE_KEY, "all").catch(() => {});
    }
    notifyListeners({
      city: trimmedCity,
      exactLocation: trimmedExact,
      fullAddress: trimmedExact,
      locationTitle: trimmedTitle,
    });
  }, []);

  return [
    city,
    setCity,
    {
      exactLocation,
      fullAddress,
      locationTitle,
      setLocation,
      detectingLocation,
      fetchCurrentLocation,
      initialized,
    },
  ];
}
