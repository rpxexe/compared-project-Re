// The CompareProjects website. Set EXPO_PUBLIC_WEB_URL (e.g. https://compareprojects.com) in
// frontend/.env or eas.json once it's live; until then property links are simply not shown.
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "").trim().replace(/\/+$/, "");

// Public page for a listing on the website, or "" while no web address is configured.
// Change the path here if the website uses a different URL pattern.
export const propertyWebUrl = (id) => (WEB_URL && id ? `${WEB_URL}/property/${encodeURIComponent(id)}` : "");
