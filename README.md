# COMPARE PROJECT – premium real-estate mobile app

Discover, compare and post properties. Android-first React Native (Expo) app with a Node.js / Express / MongoDB backend.

## 1. What it does
* **Home** – greeting, city selector, search, quick type chips, Featured / New launches / Top rated / Upcoming rails, popular cities, recently added.
* **Compare Project** – pick up to 4 projects and see them side by side (price, BHK, area, possession, parking, amenities, RERA, rating …). Missing data shows `N/A`.
* **Post Property** – validated form; saved to the existing `properties` collection with `dataSource: "manual"` and live immediately. Developer accounts can only list for sale.
* **New Project** – New Launch / Upcoming / Under Construction / Ready to Move. A category appears **only if MongoDB has data for it**.
* **Ratings & reviews** – 1–5 star rating + optional comment on every property, rating distribution, averages shown on cards, a *Top rated* rail and *Top rated* sort. One rating per user per property (editable); owners cannot rate their own listing.
* **Property details** – swipe gallery, facts, developer, RERA, amenities/facilities/security, floor plans, virtual tour, brochure, map link, save, compare, share, sticky **Enquire Now**.
* **Profile** – saved properties, my posted properties, my enquiries, settings, logout. The app has no admin screens.
* Login: **mobile + OTP**, animated splash, welcome, purpose selection (Buyer / Investor / Owner / Resale / Broker), animated welcome.

All property content comes from MongoDB through the API. **No demo/fake listings exist anywhere in the shipped app.** (Test fixtures live only in `backend/test/` and the test-suite's in-memory database.)

## 2. Tech stack
Expo SDK 54 · React Native 0.81 · React Navigation 7 · Animated API (no heavy animation library) · Node ≥ 20 · Express 5 · Mongoose 8 · JWT · MongoDB Atlas.

## 3. Folder structure
```
backend/   src/{config,middleware,models,routes,utils}  test/  scripts/
frontend/  src/{components,context,hooks,navigation,screens,services,theme,utils}  assets/  test/
README.md  SETUP.md  TEST-CASES.md
```

## 4. MongoDB setup
1. Use your existing Atlas cluster that already holds the `properties` collection.
2. Atlas → *Network Access*: allow your IP (or `0.0.0.0/0` for a hosted backend).
3. Put the connection string **only** in `backend/.env` (see below). Never in the app, never in Git.
4. The app **reads** existing property documents untouched. It creates its own collections: `app_customers` (phone/OTP accounts), `app_users` (email/password accounts: developers, CRM staff), `otps` (auto-expire), `enquiries`, `reviews`, `property_ratings`. New posted properties are inserted into `properties`.
5. Verify access and see which field names your documents use: `cd backend && npm run check:db`.

## 5. Backend setup
```bash
cd backend
npm install
cp .env.example .env      # then edit MONGODB_URI, JWT_SECRET
npm test                  # no database needed
npm run check:db          # optional: real MongoDB connectivity check
npm start                 # http://0.0.0.0:5000/api/health
```

## 6. Frontend setup
```bash
cd frontend
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npx expo start -c
```

## 7. Environment variables
| File | Variable | Purpose |
|---|---|---|
| backend/.env | `MONGODB_URI` | **required** Atlas connection string |
| | `MONGODB_COLLECTION` | property collection, default `properties` |
| | `NODE_ENV` | `development`, `test` or `production`. **Missing/unknown = treated as production** (no dev OTPs, no open CORS) |
| | `JWT_SECRET` | 24+ random chars (required) |
| | `OTP_MODE` | `development` (only with NODE_ENV development/test) or `twilio` (everywhere else; default outside development) |
| | `OTP_TTL_MINUTES`, `OTP_RESEND_SECONDS`, `OTP_MAX_ATTEMPTS` | OTP policy (5 / 30 / 5) |
| | `OTP_GLOBAL_HOURLY_LIMIT` | anti SMS-pumping cap on OTP SMS per hour for the whole server (default 300) |
| | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS provider (required with `OTP_MODE=twilio`) |
| | `TRUST_PROXY` | reverse proxies in front of the API (default `1`; `0` when exposed directly). Rate limits use the client IP derived from it |
| | `CORS_ORIGINS` | browser origins allowed. Production with this empty sends **no** CORS headers (the mobile app doesn't need CORS) |
| | `PUBLIC_URL` | public https origin used in uploaded image URLs |
| | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` | /api/v2 customer sign-in; the service account is required for token revocation checks |
| frontend/.env | `EXPO_PUBLIC_API_URL` | backend address ending in `/api` |

## 8. OTP – development mode
`OTP_MODE=development` (only with `NODE_ENV=development` or `test`): the OTP is returned to the app as `devOtp` and is never logged; **development builds** of the app show a “tap to fill” chip (release builds never do). Never use it on a public server, because anyone can “verify” any number. Codes are stored hashed (HMAC), single-use, expire after `OTP_TTL_MINUTES`, lock after `OTP_MAX_ATTEMPTS` wrong tries (counted atomically, so parallel guesses can't exceed it), 30 s resend cooldown.

## 9. OTP – production (Twilio)
Set `OTP_MODE=twilio` plus the three `TWILIO_*` variables on the server. Development OTPs **fail closed**: the backend refuses to start with `OTP_MODE=development` unless `NODE_ENV` is explicitly `development` or `test` – a missing `NODE_ENV` counts as production. Twilio credentials never reach the app. OTP sending is limited per IP, per number and globally (`OTP_GLOBAL_HOURLY_LIMIT`) against SMS pumping. For Indian SMS you may need DLT registration with your provider.

## 10. Android physical phone
1. Phone and PC on the same Wi-Fi. Find the PC IP (`ipconfig` / `ip a`).
2. `frontend/.env` → `EXPO_PUBLIC_API_URL=http://<PC_LAN_IP>:5000/api`
3. Allow port 5000 in the PC firewall. Open `http://<PC_LAN_IP>:5000/api/health` in the phone browser – it must show `{"ok":true…}`.
4. `npx expo start -c`, open **Expo Go** and scan the QR code.
**USB alternative:** enable USB debugging, `adb reverse tcp:5000 tcp:5000`, then use `http://localhost:5000/api`.

## 11. Android emulator
`EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api`, start an AVD, press `a` in the Expo terminal.

## 12. Testing
```bash
cd backend  && npm test      # API, auth, roles, ratings, OTP, startup guards
cd frontend && npm test      # validation, compare logic, error mapping
cd frontend && npm run bundle:check   # compiles the whole app with Metro
```
Manual device checklist: `TEST-CASES.md`.

## 13. Roles and enquiries
Roles: `user`, `broker`, `developer`. User and staff management lives in the separate CRM; the API has no admin routes, and a phone login never changes a role.
* Choosing “Broker” as purpose gives the `broker` role.
* Email/password accounts (the Login screen's Developer card) are `developer`s: they only post listings for sale and manage them; they get no browsing screens.
* **Developer accounts are created by an administrator only** (there is no public sign-up; `POST /api/auth/signup` returns 404):
  ```bash
  cd backend
  npm run create:developer -- --email sales@builder.com --name "Skyline Builders" [--phone 9876543210]
  ```
  It generates a strong random password and prints it **once** (only a scrypt hash is stored). Hand it to the developer over a secure channel. Duplicate emails are refused.
* **Sign out everywhere:** `POST /api/auth/logout-all` (signed in) bumps the account's `tokenVersion`, so every JWT issued before (all devices) gets 401, and revokes the linked Firebase session. The app calls it on every Log out (best effort – local sign-out and data wipe happen even offline).
* **Enquiries for the CRM:** the backend has no CRM API. Enquiries from the app are saved in the `enquiries` collection and contact forms from `/api/v2/leads/customer` in `customer_leads`; the CRM reads them from MongoDB directly.

### API summary
`GET /api/health` · `POST /api/auth/send-otp` · `POST /api/auth/verify-otp` · `POST /api/auth/signin` · `POST /api/auth/logout-all` · `GET|PATCH /api/users/me` · `GET /api/users/me/{properties,enquiries}` · `GET /api/properties` (search, filters, sort, paging) · `GET /api/properties/{categories,facets,top-rated,compare,saved/list,:id}` · `POST|DELETE /api/properties/:id/save` · `GET|POST /api/properties/:id/reviews` · `DELETE /api/properties/:id/reviews/mine` · `POST /api/post-property` · `POST /api/enquiries` · Mobile API contract (Firebase customer auth): `/api/v2/*`, see `MOBILE_API.md`.

## 14. Production deployment (Render / Railway)
* Root directory `backend`, build `npm install`, start `npm start`.
* Environment: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `OTP_MODE=twilio`, `TWILIO_*`, `TRUST_PROXY` (1 on Render/Railway), `PUBLIC_URL`, `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT`, optionally `CORS_ORIGINS`, `OTP_GLOBAL_HOURLY_LIMIT`.
* Production `/api/health` answers only `{"ok":true}`.
* Uploaded photos are re-encoded with `sharp` (EXIF/GPS stripped, JPEG) – `npm install` on the server fetches its Linux binary.
* Health check path `/api/health`. Use the **https** URL in the app (`EXPO_PUBLIC_API_URL=https://…/api`) – Android release builds block plain `http://`.

## 15. EAS Android build
```bash
npm i -g eas-cli && eas login
cd frontend
eas build:configure                       # first time only (fills extra.eas.projectId)
# edit eas.json → set EXPO_PUBLIC_API_URL to your https backend
eas build --platform android --profile preview      # installable APK
eas build --platform android --profile production   # AAB for Play Store
```
Local native build: `npx expo prebuild --platform android && npx expo run:android`.

## 16. Troubleshooting
* **“Cannot reach the server”** – wrong `EXPO_PUBLIC_API_URL`, firewall, different Wi-Fi, or you forgot `npx expo start -c` after editing `.env`. Settings → *Check server connection* tests it. A release build without `EXPO_PUBLIC_API_URL` has no fallback address.
* **Config error: MONGODB_URI is missing** – create `backend/.env`.
* **MongoDB timeout** – add your IP in Atlas Network Access.
* **No OTP arrives** – in development the code is shown in the app's dev chip (development builds only); in production verify Twilio variables.
* **Config error: OTP_MODE must be "twilio"** – set `NODE_ENV=development` for local development, or configure Twilio.
* **Every /api/v2 request returns 401 "Invalid token"** – set `FIREBASE_SERVICE_ACCOUNT` (needed for token revocation checks).
* **Empty lists** – the database really has no matching documents; run `npm run check:db`.
* **Images blank** – the document's image URLs are missing/unreachable; a placeholder is shown, nothing is invented.
