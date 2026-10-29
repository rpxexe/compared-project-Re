import * as Location from "expo-location";

/**
 * Common popular Indian metro cities for quick suggestions.
 */
export const POPULAR_CITIES = [
  "Mumbai",
  "Pune",
  "Delhi NCR",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Thane",
  "Navi Mumbai",
  "Noida",
  "Gurugram",
];

/**
 * Format address details into clean Zomato/Rapido style Title, Subtitle, and Full Address.
 */
export function formatAddressDetails(addr = {}, displayName = "") {
  const road = (addr.road || addr.street || "").trim();
  const suburb = (
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.subdivision ||
    addr.residential ||
    addr.city_district ||
    addr.district ||
    ""
  ).trim();
  const city = (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    ""
  ).trim();
  const state = (addr.state || "").trim();
  const postcode = (addr.postcode || "").trim();

  // Locality is strictly the area / neighborhood (e.g. "Bandra West", "Khar", "Indiranagar")
  const locality = suburb || (road ? road : city);

  // Title: prioritize locality/suburb so road name is NOT prepended
  let title = suburb || road || city || "Location";
  if (!title && displayName) {
    title = displayName.split(",")[0].trim();
  }

  // Secondary Subtitle: e.g. "Mumbai, Maharashtra 400052"
  const subParts = [city, state, postcode].filter(Boolean);
  const subtitle = subParts.join(", ");

  // Full Address
  let full = displayName || [road, suburb, subtitle].filter(Boolean).join(", ");
  full = full
    .replace(/,\s*India$/i, "")
    .replace(/,\s*,/g, ",")
    .trim();

  return {
    title: title.trim(),
    subtitle: subtitle.trim(),
    fullAddress: full.trim(),
    city: city.trim(),
    locality: locality.trim(),
    state: state.trim(),
    postcode: postcode.trim(),
  };
}

/**
 * Matches detected city against available database cities.
 */
export function matchWithAvailableCities(detectedCity, availableCities = []) {
  if (!detectedCity) return "";
  const cleanDetected = detectedCity.toLowerCase().trim();

  const exact = availableCities.find(
    (c) => c.toLowerCase().trim() === cleanDetected
  );
  if (exact) return exact;

  const partial = availableCities.find((c) => {
    const cleanC = c.toLowerCase().trim();
    return cleanDetected.includes(cleanC) || cleanC.includes(cleanDetected);
  });
  if (partial) return partial;

  const popular = POPULAR_CITIES.find((c) => {
    const cleanC = c.toLowerCase().trim();
    return cleanDetected.includes(cleanC) || cleanC.includes(cleanDetected);
  });
  if (popular) return popular;

  return detectedCity.trim();
}

/**
 * Search locations across India like Zomato / Rapido:
 * Users can search road name, locality, city name, state name.
 * Strictly filtered to India (countrycode === 'IN').
 */
export async function searchIndiaLocations(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];

  const results = [];
  const seenAddresses = new Set();

  const addResult = (item) => {
    if (!item || !item.fullAddress) return;
    const key = item.fullAddress.toLowerCase().trim();
    if (!seenAddresses.has(key)) {
      seenAddresses.add(key);
      results.push(item);
    }
  };

  // 1. Try Photon Geocoder API (Fast, designed for search-as-you-type)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      q
    )}&limit=15&lat=20.5937&lon=78.9629`;

    let res = await fetch(photonUrl, { signal: controller.signal });
    let data = res.ok ? await res.json() : null;
    clearTimeout(timer);

    let features = (data?.features || []).filter((f) => {
      const cc = (f.properties?.countrycode || "").toUpperCase();
      const country = (f.properties?.country || "").toLowerCase();
      return cc === "IN" || country.includes("india");
    });

    // If no Indian results found and query doesn't already contain 'india', retry Photon with ' India'
    if (features.length === 0 && !q.toLowerCase().includes("india")) {
      try {
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), 4000);
        const retryUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q + " India"
        )}&limit=15&lat=20.5937&lon=78.9629`;
        const retryRes = await fetch(retryUrl, { signal: retryController.signal });
        clearTimeout(retryTimer);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          features = (retryData?.features || []).filter((f) => {
            const cc = (f.properties?.countrycode || "").toUpperCase();
            const country = (f.properties?.country || "").toLowerCase();
            return cc === "IN" || country.includes("india");
          });
        }
      } catch {
        // ignore retry error
      }
    }

    if (features.length > 0) {
      features.forEach((f, i) => {
        const p = f.properties || {};
        const name = (p.name || p.street || "").trim();
        const locality = (p.locality || p.district || "").trim();
        const city = (p.city || p.county || "").trim();
        const state = (p.state || "").trim();
        const postcode = (p.postcode || "").trim();

        // Clean locality: area / neighborhood (e.g. "Bandra West" or "Khar")
        const trueLocality = (locality && locality.toLowerCase() !== city.toLowerCase()) ? locality : name;
        // Title: specific place name (e.g. "Bandra West" or "Swami Vivekanand Road")
        const title = name || locality || city || "Location";
        // Subtitle: e.g. "Khar, Mumbai, Maharashtra 400052"
        const subParts = [
          locality && locality.toLowerCase() !== name.toLowerCase() && locality.toLowerCase() !== city.toLowerCase()
            ? locality
            : "",
          city,
          state,
          postcode,
        ].filter(Boolean);
        const subtitle = subParts.join(", ");
        // Full Address
        let full = [title, subtitle].filter(Boolean).join(", ");
        full = full.replace(/,\s*,/g, ",").trim();

        addResult({
          id: `photon-${p.osm_id || i}`,
          title: title.trim(),
          subtitle: subtitle.trim(),
          fullAddress: full.trim(),
          city: (city || state || "").trim(),
          locality: trueLocality.trim(),
          state: state.trim(),
          postcode: postcode.trim(),
          latitude: f.geometry?.coordinates?.[1] || 0,
          longitude: f.geometry?.coordinates?.[0] || 0,
          source: "photon",
        });
      });
    }
  } catch (err) {
    console.log("[LocationService] Photon search failed, trying Nominatim:", err?.message);
  }

  // 2. If results are sparse (< 4), query OpenStreetMap Nominatim Search (Strictly countrycodes=in)
  if (results.length < 4) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&addressdetails=1&countrycodes=in&limit=15`;

      const res = await fetch(nominatimUrl, {
        headers: { "User-Agent": "CompareProjectsApp/2.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        (data || []).forEach((item, i) => {
          const parsed = formatAddressDetails(item.address, item.display_name);
          addResult({
            id: `nom-${item.place_id || i}`,
            ...parsed,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            source: "nominatim",
          });
        });
      }
    } catch (err) {
      console.log("[LocationService] Nominatim search failed:", err?.message);
    }
  }

  return results;
}

/**
 * Reverse geocode coordinates using Nominatim API for full address
 */
async function reverseGeocodeWithNominatim(latitude, longitude) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: { "User-Agent": "CompareProjectsApp/2.0" },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return formatAddressDetails(data?.address || {}, data?.display_name || "");
  } catch {
    return null;
  }
}

/**
 * IP Geolocation fallback (ipwho.is)
 */
export async function getCityFromIP() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://ipwho.is/", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success !== false && data.city) {
      const city = data.city.trim();
      const state = (data.region || "").trim();
      const title = city;
      const subtitle = [city, state, "India"].filter(Boolean).join(", ");
      const fullAddress = [city, state, "India"].filter(Boolean).join(", ");

      return {
        title,
        subtitle,
        fullAddress,
        city,
        locality: "",
        state,
        latitude: data.latitude,
        longitude: data.longitude,
        source: "ip",
      };
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Check if location permission is already granted without showing any popup.
 */
export async function checkLocationPermission() {
  try {
    const res = await Location.getForegroundPermissionsAsync();
    return res.status === "granted";
  } catch {
    return false;
  }
}

/**
 * Get current user location with full address, title, subtitle, and city.
 * Only triggers system permission prompt if requestIfMissing is true.
 */
export async function getCurrentUserLocation(availableCities = [], requestIfMissing = true) {
  let locationResult = null;

  try {
    let { status } = await Location.getForegroundPermissionsAsync();

    // Only prompt user if not already granted AND requestIfMissing is true
    if (status !== "granted" && requestIfMissing) {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }

    if (status === "granted") {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = pos.coords;

      // Reverse geocode via Nominatim for full address
      let reverseResult = await reverseGeocodeWithNominatim(latitude, longitude);

      // If Nominatim failed, try native expo reverse geocode
      if (!reverseResult || !reverseResult.fullAddress) {
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          if (addresses && addresses.length > 0) {
            const a = addresses[0];
            const road = a.street || a.name || "";
            const suburb = a.subregion || a.district || "";
            const city = a.city || a.subregion || a.district || "";
            const state = a.region || "";
            const postcode = a.postalCode || "";
            const title = (suburb || road || city).trim();
            const subtitle = [city, state, postcode].filter(Boolean).join(", ");
            const full = [road, suburb, subtitle].filter(Boolean).join(", ");

            reverseResult = {
              title,
              subtitle,
              fullAddress: full,
              city,
              locality: (suburb || road || city).trim(),
              state,
              postcode,
            };
          }
        } catch {
          // ignore
        }
      }

      if (reverseResult && (reverseResult.fullAddress || reverseResult.city)) {
        const matchedCity = matchWithAvailableCities(
          reverseResult.city,
          availableCities
        );

        locationResult = {
          title: reverseResult.locality || reverseResult.title || matchedCity,
          subtitle: reverseResult.subtitle || "",
          fullAddress: reverseResult.fullAddress || matchedCity,
          exactLocation: reverseResult.fullAddress || matchedCity,
          city: matchedCity || reverseResult.city,
          locality: reverseResult.locality || "",
          state: reverseResult.state || "",
          latitude,
          longitude,
          source: "gps",
        };
      }
    }
  } catch (error) {
    console.log("[LocationService] GPS query error:", error?.message);
  }

  // IP fallback
  if (!locationResult || !locationResult.fullAddress) {
    try {
      const ipResult = await getCityFromIP();
      if (ipResult && ipResult.city) {
        const matchedCity = matchWithAvailableCities(
          ipResult.city,
          availableCities
        );
        locationResult = {
          title: ipResult.title || matchedCity,
          subtitle: ipResult.subtitle || "",
          fullAddress: ipResult.fullAddress || matchedCity,
          exactLocation: ipResult.fullAddress || matchedCity,
          city: matchedCity,
          locality: "",
          state: ipResult.state || "",
          latitude: ipResult.latitude,
          longitude: ipResult.longitude,
          source: "ip",
        };
      }
    } catch (err) {
      console.log("[LocationService] IP fallback error:", err?.message);
    }
  }

  if (!locationResult || !locationResult.fullAddress) {
    throw new Error(
      "Unable to determine location automatically. Please search for your location."
    );
  }

  return locationResult;
}
