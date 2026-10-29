# CompareProjects – UI redesign update

This update is applied on top of your existing Expo / React Native app (`frontend/`) and Node/Express backend (`backend/`).
Stack, routes, API contracts, auth/OTP, search, compare, reviews, admin screens and the database layer are unchanged.

## What changed

| Area | Change |
|---|---|
| Theme | Palette in `frontend/src/theme/index.js` is now dark-violet / neon-purple (same token names, so every screen re-themes). Dark violet is used for the intro, headers, buttons, CTA cards and tab accents; content surfaces are soft lavender-white for readability. New tokens: `neon`, `violet`, `deepViolet`, `glow`. |
| Intro animation | `screens/SplashScreen.js` + `components/CPMark.js`. SVG stroke-drawn CP monogram: violet light sweep → C arc → vertical stroke → P bowl → glowing complete logo → "CompareProjects" slides up → particles settle → fade into the app (~4.2 s). Plays once per app launch, respects the OS *Reduce Motion* setting (static logo, short hold), and can never block the app (error boundary + 7 s watchdog in `App.js`). |
| Logo / icons | `components/Logo.js` now renders the CP monogram tile + "CompareProjects" wordmark. `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png` regenerated with the same monogram. |
| Duplicate Post Property | The Home header contained its own half-built "Post Property" button (plus leftover Rent/Sale/Residential/Commercial text toggles) in addition to the bottom-tab "Post Property". The header button and its dead state/handlers were removed in `screens/HomeScreen.js`; the bottom tab remains the single entry. (The "Have a property to sell?" promo card is a banner, not a nav item, and still opens the same tab.) |
| Post Property flow | Tab **Post Property** (`screens/PostPropertyScreen.js`) = Step 1 *Rent / Resale* dropdown → Step 2 *Residential / Commercial* dropdown → **Continue** opens the form (`screens/PostPropertyFormScreen.js`) with both values passed as route params. The form never asks them again; they are shown as read-only pills. |
| Progressive form | 7 steps with a "Step X of 7" progress bar, Back / Continue, per-step validation, values kept when going back, conditional fields: 1 Basics · 2 Location · 3 Specifications · 4 Pricing & availability · 5 Amenities · 6 Photos · 7 Description, contact & review (summary with *Edit* links) → Submit. Field rules and payload building live in `utils/postPropertyFlow.js` (pure, unit-tested). |
| Backend (tiny) | `backend/src/routes/postProperty.js`: BHK is no longer required for commercial listings, and `Showroom`, `Industrial`, `Co-working Space` are treated as no-BHK types. Previously these three commercial types could never be submitted. |
| Responsive | `Screen` centres content at max 760 px (tablets/landscape); new screens use `useWindowDimensions`, wrapping chips, 40–56 px touch targets, safe-area aware footer, keyboard avoiding layout. |

## Things worth knowing

* **"Resale" is sent to the backend as `listingType: "sale"`** – that is the value your API already accepts (`rent` | `sale`). `category` is sent as `residential` | `commercial`.
* **Photos are image links (http/https URLs)** – that is what the existing backend accepts; there is no file-upload endpoint in the project, so none was invented.
* Deposit / maintenance / lease fields are not shown because the backend has no fields for them.
* The old `PrePostPropertyTypeScreen` (Developer/Broker) is not reachable from the UI and was left untouched.
* The theme is dark-violet chrome with light lavender content surfaces rather than a fully dark app.

## Run

```bash
# backend
cd backend && cp .env.example .env   # fill MONGODB_URI, JWT_SECRET (see SETUP.md)
npm install && npm start

# frontend (new terminal)
cd frontend && cp .env.example .env  # EXPO_PUBLIC_API_URL=http://<host>:5000/api
npm install
npx expo start -c
```
USB Android: `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:5000 tcp:5000`, with `EXPO_PUBLIC_API_URL=http://127.0.0.1:5000/api`.

## Tests

```bash
cd frontend && npm test          # pure-logic tests (incl. new postPropertyFlow tests)
cd backend  && npm test          # API tests (needs npm install first)
cd frontend && npm run bundle:check   # optional: confirms the Android bundle compiles
```
