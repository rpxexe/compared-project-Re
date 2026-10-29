# COMPARE PROJECT – premium real-estate mobile app

Discover, compare and post properties. Android-first React Native (Expo) app with a Node.js / Express / MongoDB backend.

## 1. What it does
* **Home** – greeting, city selector, search, quick type chips, Featured / New launches / Top rated / Upcoming rails, popular cities, recently added.
* **Compare Project** – pick up to 4 projects and see them side by side (price, BHK, area, possession, parking, amenities, RERA, rating …). Missing data shows `N/A`.
* **Post Property** – validated form; saved to the existing `properties` collection with `dataSource: "manual"` and sent for admin approval.
* **New Project** – New Launch / Upcoming / Under Construction / Ready to Move. A category appears **only if MongoDB has data for it**.
* **Ratings & reviews** – 1–5 star rating + optional comment on every property, rating distribution, averages shown on cards, a *Top rated* rail and *Top rated* sort. One rating per user per property (editable); owners cannot rate their own listing; admins can remove abusive reviews.
* **Property details** – swipe gallery, facts, developer, RERA, amenities/facilities/security, floor plans, virtual tour, brochure, map link, save, compare, share, sticky **Enquire Now**.
* **Profile** – saved properties, my posted properties (with review status), my enquiries, settings, logout. Admin dashboard appears here only for `admin`/`superadmin`.
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
4. The app **reads** existing property documents untouched. It creates its own collections: `app_users`, `otps` (auto-expire), `enquiries`, `reviews`, `property_ratings`. New posted properties are inserted into `properties`.
5. Verify access and see which field names your documents use: `cd backend && npm run check:db`.

## 5. Backend setup
```bash
cd backend
npm install
cp .env.example .env      # then edit MONGODB_URI, JWT_SECRET, ADMIN_PHONES
npm test                  # 52 tests, no database needed
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
| | `JWT_SECRET` | 24+ random chars (required in production) |
| | `OTP_MODE` | `development` or `twilio` |
| | `OTP_TTL_MINUTES`, `OTP_RESEND_SECONDS`, `OTP_MAX_ATTEMPTS` | OTP policy (5 / 30 / 5) |
| | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS provider |
| | `ADMIN_PHONES`, `SUPERADMIN_PHONES` | comma-separated 10-digit numbers promoted after OTP login |
| | `AUTO_APPROVE_POSTS` | `true` = posted properties go live immediately |
| | `CORS_ORIGINS` | only needed for browser clients |
| frontend/.env | `EXPO_PUBLIC_API_URL` | backend address ending in `/api` |

## 8. OTP – development mode
`OTP_MODE=development`: the OTP is printed in the backend console and returned as `devOtp`; the OTP screen shows a “tap to fill” chip. Codes are stored hashed (HMAC), single-use, expire after `OTP_TTL_MINUTES`, lock after 5 wrong tries, 30 s resend cooldown.

## 9. OTP – production (Twilio)
Set `OTP_MODE=twilio` plus the three `TWILIO_*` variables on the server. The backend then **refuses to start** in production with `OTP_MODE=development`. Twilio credentials never reach the app. For Indian SMS you may need DLT registration with your provider.

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

## 13. Admin / roles
Roles: `user`, `broker`, `admin`, `superadmin`.
* Add your number to `ADMIN_PHONES` / `SUPERADMIN_PHONES` in `backend/.env`, restart, log in with OTP → the role is applied. Superadmins can later change roles via `PATCH /api/admin/users/:id`.
* Choosing “Broker” as purpose gives the `broker` role (no admin rights).
* **Security:** every `/api/admin/*` route runs `authRequired` + `requireRole('admin','superadmin')` on the server and re-reads the role from MongoDB on every request, so a hidden button is never the protection. Normal users get **403**, anonymous users **401** (covered by tests).
* In the app: *Profile → Admin dashboard* (visible only to admins): stats, users, properties (approve / reject / feature), enquiries (status workflow). Superadmin-only API: change role, disable user, delete app-posted properties (imported data is protected).

### API summary
`GET /api/health` · `POST /api/auth/send-otp` · `POST /api/auth/verify-otp` · `GET|PATCH /api/users/me` · `GET /api/users/me/{properties,enquiries}` · `GET /api/properties` (search, filters, sort, paging) · `GET /api/properties/{categories,facets,top-rated,compare,saved/list,:id}` · `POST|DELETE /api/properties/:id/save` · `GET|POST /api/properties/:id/reviews` · `DELETE /api/properties/:id/reviews/mine` · `POST /api/post-property` · `POST /api/enquiries` · `GET /api/admin/{stats,users,properties,enquiries}` · `PATCH /api/admin/{users,properties,enquiries}/:id` · `DELETE /api/admin/{properties,reviews}/:id`.

## 14. Production deployment (Render / Railway)
* Root directory `backend`, build `npm install`, start `npm start`.
* Environment: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `OTP_MODE=twilio`, `TWILIO_*`, `ADMIN_PHONES`.
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
* **“Cannot reach the server”** – wrong `EXPO_PUBLIC_API_URL`, firewall, different Wi-Fi, or you forgot `npx expo start -c` after editing `.env`. Settings → *Check server connection* tests it.
* **Config error: MONGODB_URI is missing** – create `backend/.env`.
* **MongoDB timeout** – add your IP in Atlas Network Access.
* **No OTP arrives** – in development read the backend console; in production verify Twilio variables.
* **Empty lists** – the database really has no matching documents; run `npm run check:db`.
* **Images blank** – the document's image URLs are missing/unreachable; a placeholder is shown, nothing is invented.
