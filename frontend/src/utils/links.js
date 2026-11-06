// Opening links that come from listing data (brochures, virtual tours, map links, floor plans).
// That data is not ours: an imported or posted listing could carry upi://, tel:, intent:,
// javascript:, file: or a custom-scheme link that starts a payment, a call or another app.
// Only absolute https:// web addresses are ever handed to the OS.

const MAX_URL_LENGTH = 2048;

// The URL to open, or null when it isn't a safe https:// address.
export function safeExternalUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > MAX_URL_LENGTH || /[\s\u0000-\u001f\u007f\\]/.test(url)) return null;
  // Scheme, then "//" authority: rules out "https:foo", "javascript:", "intent:", "upi:" etc.
  const m = /^https:\/\/([^/?#]+)([/?#].*)?$/i.exec(url);
  if (!m) return null;
  const authority = m[1];
  // No credentials (https://good.com@evil.com) and a plausible host[:port].
  if (authority.includes("@")) return null;
  if (!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d{1,5})?$/i.test(authority) && !/^\[[0-9a-f:.]+\](?::\d{1,5})?$/i.test(authority)) return null;
  return url;
}

export const isSafeExternalUrl = (value) => safeExternalUrl(value) !== null;

// Opens a safe https:// link in the browser. Resolves true when opened, false when the link was
// refused or could not be opened (`onError` is called with a user-facing message).
// `opener` is injectable for tests; the app uses React Native's Linking.
export async function openExternal(url, { onError, opener } = {}) {
  const safe = safeExternalUrl(url);
  if (!safe) {
    onError?.("This link can't be opened.");
    return false;
  }
  try {
    if (opener) await opener(safe);
    else await require("react-native").Linking.openURL(safe);
    return true;
  } catch {
    onError?.("Could not open this link");
    return false;
  }
}
