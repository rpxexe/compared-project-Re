# Mobile API (v2): property browsing, search, compare, hearts and leads

This backend implements the **Mobile API Contract** (`mobile-api-contract.md`) under the base path
`/api/v2`. It matches the contract's paths, parameters, response bodies, limits and error shapes.
That includes the contract's three different error formats and its public lead endpoint.

The v1 routes (`/api/properties`, `/api/users/me`, `/api/enquiries`, …) that the current app uses
are unchanged. The app can move to v2 one screen at a time.

```
https://<api-host>/api/v2
```

Contents: [Authentication](#authentication) · [Endpoints](#endpoints) ·
[Differences from the website backend](#differences-from-the-website-backend) ·
[Firebase setup](#firebase-setup) · [Testing](#testing)

---

## Authentication

Customer endpoints take a **Firebase ID token**. The v1 JWT is not accepted here.
```
Authorization: Bearer <firebaseIdToken>
```

Every authentication failure returns **401** with a bare `{ message }`, as the contract specifies:

| Condition | Body |
|---|---|
| No token | `{ "message": "No token" }` |
| Token invalid, malformed, from another project, or expired; also returned when Firebase isn't configured on the server | `{ "message": "Invalid token" }` |
| Token valid, but no customer account is linked to this Firebase user (or the account is disabled) | `{ "message": "Customer not found" }` |

### POST `/api/v2/customers/register` (added; not in the contract)
The contract assumes a customer account already exists for each Firebase user, but doesn't say how
one gets created. Call this endpoint **once after every Firebase sign-in**. It is safe to call
repeatedly. It takes a Firebase token, but no customer account is needed yet.

| Firebase sign-in | Result |
|---|---|
| Phone number | Links the existing app account with that number, so v1 saved properties carry over. If there is none, a new account is created. |
| Email | **The email must be verified.** Links the existing email account, or creates one. |

Request body (optional): `{ "name": "Asha Rao" }`, used when a new account is created.

| Response | Meaning |
|---|---|
| `201 { success: true, created: true, customer }` | A new account was created |
| `200 { success: true, created: false, customer }` | An existing account was linked or found |
| `400` | The email isn't verified, or the token has no phone number or email |
| `403` | The account is disabled |
| `409` | That phone number or email is already linked to a different Firebase user |

`customer` = `{ id, name, fullName, phone, email, role, purpose, city, accountType, isActive, createdAt, lastLoginAt }`.

The response also has `token`, `user` and `isNewUser`, the same session `POST /api/auth/verify-otp`
returns. An app that signs in with Firebase uses this `token` for the v1 routes (profile, posting,
enquiries, notifications) and the Firebase ID token for `/api/v2`.

---

## Endpoints

Each behaviour below is exactly as described in the contract. These notes show where to find it in the code.

| Contract endpoint | Auth | Rate limit (per IP) |
|---|---|---|
| `GET /properties/filters` | – | – |
| `GET /properties/localities-by-type` | – | – |
| `GET /properties/localities/:city` | – | – |
| `GET /properties/location-options?q=&city=` | – | 30/min, shared with search |
| `GET /properties/featured?limit=&city=` | – | 120/min, shared with listing and recent |
| `GET /properties/recent?limit=&city=` | – | 120/min, shared |
| `GET /properties` (listing and filters) | – | 120/min, shared |
| `GET /properties/search?query=&limit=` | – | 30/min, shared with autocomplete |
| `GET /properties/related/:id` | – | – |
| `GET /properties/:id` | – | – |
| `GET /customerActivity/my-activity?heartPage=&heartLimit=` | Firebase | 60/min, shared by all three activity routes |
| `PUT /customerActivity/compare` (**full replace**, max 4) | Firebase | 60/min, shared |
| `POST /customerActivity/toggle-heart/:propertyId` (max 200) | Firebase | 60/min, shared |
| `POST /leads/customer` (**public**, 24-hour dedupe per email + property) | – | 50 per 15 min |

Code: routes in `backend/src/routes/v2.js`; handlers in `backend/src/controllers/v2-*.js`; the
property shape in `backend/src/utils/contractProperty.js`; Firebase auth in
`backend/src/middleware/firebaseAuth.js`.

**Error formats**, as in the contract:
- Property routes and lead validation: `{ success: false, message }`.
- Customer-activity and auth errors: `{ message }`.
- 429 responses: `{ error }`, except leads, which return `{ success: false, message }`.

---

## Differences from the website backend

These follow from our data and from what the contract leaves unspecified:

- **Base path:** everything is under `/api/v2`, plus the extra `POST /customers/register`.
- **Images:** `coverImage` is `{ "url": "…" }` and `galleryImages` is `[{ "url": "…" }]`. Our
  listings come from several sources, so their images are normalised to this shape.
- **`slug`** is `null`. Our listings have no slugs, which the contract also doesn't rely on.
- **`pricePerSqft`** only appears on `/featured`. As the contract says, compute `price / area.value` elsewhere.
- **`area`** is always in sq.ft (`{ value, unit: "sqft" }`). `areaUnit` on `GET /properties`
  accepts `sqft`, `sqmts`, `guntas`, `hectares` and `acres`.
- **`toggle-heart` on an unknown or hidden listing** returns `404 { message: "Property not found" }`. The contract doesn't define this case.
- **Instant search fuzzy fallback:** like the website, this uses **fuse.js** when the exact and
  regex matches find nothing. It searches the 500 newest listings that pass the parsed filters (BHK,
  price, RERA, furnishing) on title, locality, city, type and developer (`threshold: 0.4`), and every
  query word has to match one of those fields. As the contract describes, `state`, `galleryImages`
  and `reraApproved` are left out when `fuzzy: true`.
- **Lead validation** uses a **zod** schema (`leadSchema` in `v2-leads-controller.js`), and the 400
  body is `z.flattenError()`, so it has the same `{ formErrors, fieldErrors }` shape as the website.
  Unknown fields are dropped.
- **Lead rate limit:** there is no developer-side lead endpoint here, so the 50 per 15 minutes applies only to `/leads/customer`.
- **Linked to the rest of the system:**
  - Hearts are the same list as v1 saved properties.
  - Hearting a listing, and every non-duplicate lead form, also create or update a **CRM lead**
    (sources `saved` and `form`; see `CRM_API.md`), so staff see them straight away.
  - A form from a phone number that belongs to an app account is merged into that customer's existing lead for the listing.

---

## Firebase setup

### 1. Firebase project
1. In the [Firebase console](https://console.firebase.google.com), open your project or create one.
   **If customers should have one login across the website and the app, use the same Firebase project as the website.**
2. Go to **Authentication → Get started → Sign-in method** and enable the providers you'll offer:
   - **Phone**: the app's current login. Optionally add test numbers under *Phone numbers for testing*.
   - **Email/Password**: optional. Customers must verify their email before `/customers/register` accepts them.

### 2. Register the apps in Firebase
1. Go to **Project settings → General → Your apps → Add app**.
2. **Android**: package name `com.compareproject.mobile`. Add the **SHA-1 and SHA-256** fingerprints
   of your signing keys. Phone auth needs them. Get them with `eas credentials`, or with
   `cd android && ./gradlew signingReport` for local builds. Download **`google-services.json`** and put it in `frontend/`.
3. **iOS**: bundle ID `com.compareproject.mobile`. Download **`GoogleService-Info.plist`** and put it in `frontend/`.
   For phone auth on iOS, also upload an APNs key under **Project settings → Cloud Messaging**.

### 3. Backend
1. Copy the **Project ID** from **Project settings → General**.
2. In `backend/.env`, set:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   ```
   Verifying ID tokens only needs the project ID. `FIREBASE_SERVICE_ACCOUNT` (the service-account
   JSON on one line) is optional and only needed for future server-side Firebase features.
3. Restart the API. The start-up warning `FIREBASE_PROJECT_ID is not set` should no longer appear.

### 4. Mobile app (Expo): done in `frontend/`
- `@react-native-firebase/app` and `@react-native-firebase/auth` are installed and their config
  plugins are in `app.json`, with `android.googleServicesFile: "./google-services.json"`.
- `src/services/firebasePhone.js` wraps phone sign-in. When the native module is missing (Expo Go,
  the web build, installs from before this change), `available()` is false and the app falls back
  to the backend's own OTP.
- **Login** (`LoginScreen` and `OtpScreen`): Firebase sends and checks the code, including Android's
  automatic SMS verification. The app then calls `POST /api/v2/customers/register` and stores the
  returned v1 session exactly as before.
- **Hearts** (`SavedContext`) and **compare** (`CompareContext`) use `/api/v2` when there is a
  Firebase session. Compare is then also stored on the server, and a device's list is uploaded on
  first sign-in. Sessions from the old OTP keep using v1.
- `src/services/api.js` → `api.v2.*` sends the Firebase ID token, refreshes it once on
  `Invalid token`, and re-registers on `Customer not found`. Signing out also signs out of Firebase.
- After changing native config, rebuild: `npx expo prebuild --platform android`, then `npm run android`.

### 5. Check that it works
1. Sign in on the device with a Firebase test number.
2. Call `POST /api/v2/customers/register`, then `GET /api/v2/customerActivity/my-activity` with that token.
3. Both should return `success: true`.
4. Heart a listing, then check that it appears in **CRM → leads** with source `saved`.

---

## Testing
`backend/test/v2.test.js` swaps in a fake Firebase verifier and covers:
- the auth messages and account registration and linking
- every property endpoint: shapes, filters, sorting, paging, 400 and 404 bodies
- plain-language search and the fuzzy fallback
- hearts (shared with v1, the 200 cap, the CRM lead)
- my-activity paging and compare's full replace with the 4-item cap
- lead validation, the 24-hour dedupe and the CRM hand-off
- the per-area 429 bodies
