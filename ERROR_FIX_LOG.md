# Troubleshooting & Error Fixes Log

This document provides a clear, readable summary of every issue identified during project setup, why it happened, and the exact steps taken to fix it.

---

## Quick Reference Summary

| # | Issue / Symptom | Affected File | Root Cause | Status |
|---|---|---|---|---|
| **1** | `npm install` failed with `ERESOLVE` peer dependency error | [`frontend/package.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/package.json) | Missing `react-dom` in dependencies caused npm to pull conflicting React 19.3.x | **Fixed** |
| **2** | Expo Doctor reported major version mismatches & duplicate native modules | [`frontend/package.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/package.json) | Packages pinned to SDK 57/58 while project runs on Expo SDK 54 | **Fixed** |
| **3** | Expo Doctor reported `app.json` schema validation error | [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json) | `intentFilters[0].action` was defined as an array instead of a string | **Fixed** |
| **4** | Mobile app failed to reach backend APIs from physical phone | [`frontend/.env`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/.env) | Stale LAN IP address (`.36`) used instead of current active IP (`.35`) | **Fixed** |
| **5** | USB connected phone showed `java.io.IOException: Failed to download remote update` | Expo Go / Port Forwarding | Phone Wi-Fi is DOWN; phone tried to load Wi-Fi IP `192.168.1.35` over Cellular LTE without ADB port reverse | **Fixed** |
| **6** | Onboarding ("Step Inside") & native permissions request | [`frontend/src/screens/GetStartedScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/GetStartedScreen.js) | Implemented luxury onboarding asking for Location and Notifications with native Android permissions | **Implemented** |
| **7** | Redundant intermediary intent screen | [`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js) | Flow updated: Splash ➔ "Step Inside" ➔ Login ➔ Home | **Optimized** |
| **8** | Login screen redesign, Developer email/password auth & guest protection dialogue | [`frontend/src/screens/LoginScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/LoginScreen.js) | Added role selector, Developer Corporate Email/Password auth, Skip for guest surfing, and Login Dialog for Post Property/Enquiry | **Completed** |

---

## 1. `npm install` Peer Dependency Conflict (`ERESOLVE`)

### 📌 Summary
Running a standard `npm install` in the `frontend` folder crashed with `npm error code ERESOLVE`.

### 🔍 Error Details
```text
npm error code ERESOLVE
npm error ERESOLVE could not resolve
npm error While resolving: react-native-web@0.21.4
npm error Found: react@19.1.0
npm error Could not resolve dependency:
npm error peer react-dom@"^18.0.0 || ^19.0.0" from react-native-web@0.21.4
npm error Conflicting peer dependency: react@19.3.1
```

### ⚡ Why It Happened
1. The project pins `"react": "19.1.0"`.
2. The package `react-native-web` requires `react-dom` as a peer dependency (`^18.0.0 || ^19.0.0`).
3. Because `react-dom` was **omitted** from `dependencies`, `npm` automatically downloaded the newest matching version (`19.3.x`).
4. That newer `react-dom` required `react@^19.3.x`, conflicting with the root project's `19.1.0`.

### 🛠️ The Fix (Code Diff)
In [`frontend/package.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/package.json#L26-L28):
```diff
     "expo-status-bar": "^3.0.8",
     "react": "19.1.0",
+    "react-dom": "19.1.0",
     "react-native": "0.81.5",
```

### 🚀 How to Apply
```bash
cd frontend
npm install
```
*(Now completes with exit code 0 without needing `--legacy-peer-deps` or `--force`)*

---

## 2. Native Module Version Mismatches with Expo SDK 54

### 📌 Summary
`npx expo-doctor` reported that native modules were from mismatched Expo SDK versions and contained duplicate fonts.

### 🔍 Error Details
```text
✖ Check that required peer dependencies are installed: Missing peer dependency: expo-font
✖ Check that no duplicate dependencies are installed: Found duplicates for expo-font (v58.0.10 vs v14.0.12)
✖ Check that packages match versions required by installed Expo SDK:
  - expo-document-picker: expected ~14.0.8, found 57.0.3
  - expo-image-picker:    expected ~17.0.11, found 57.0.20
```

### ⚡ Why It Happened
The project runs **Expo SDK 54** (`expo@^54.0.12`), but `package.json` had packages from **Expo SDK 57/58** (`expo-document-picker@57` and `expo-image-picker@57`). This caused:
- Duplicated `expo-font` libraries inside `node_modules`.
- Risk of native crashes when opening the photo or document picker inside Expo Go on a phone.

### 🛠️ The Fix (Code Diff)
In [`frontend/package.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/package.json#L22-L33):
```diff
-    "expo-document-picker": "^57.0.3",
-    "expo-image-picker": "^57.0.20",
+    "expo-document-picker": "~14.0.8",
+    "expo-font": "~14.0.8",
+    "expo-image-picker": "~17.0.11",
     "expo-linear-gradient": "^15.0.7",
     "expo-status-bar": "^3.0.8",
     "react": "19.1.0",
     "react-dom": "19.1.0",
     "react-native": "0.81.5",
     "react-native-gesture-handler": "~2.28.0",
     "react-native-reanimated": "~4.1.1",
     "react-native-safe-area-context": "~5.6.0",
     "react-native-screens": "4.16.0",
-    "react-native-svg": "^15.15.5",
+    "react-native-svg": "15.12.1",
```

### 🚀 How to Verify
```bash
cd frontend
npm run doctor
# Output: 18/18 checks passed. No issues detected!
```

---

## 3. `app.json` Schema Validation Error

### 📌 Summary
`expo-doctor` flagged invalid syntax in the Android intent filters schema.

### 🔍 Error Details
```text
✖ Check Expo config (app.json / app.config.js) schema:
  Field: android.intentFilters[0].action - Expected type string, got array.
```

### ⚡ Why It Happened
In [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json), `action` was set to an array `["MAIN", "DOWNLOAD_COMPLETE"]`. The official Expo schema requires `action` to be a single string (such as `"VIEW"`).

### 🛠️ The Fix (Code Diff)
In [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json#L24-L34):
```diff
       "intentFilters": [
         {
+          "action": "VIEW",
           "autoVerify": true,
-          "action": ["MAIN", "DOWNLOAD_COMPLETE"],
           "data": {
             "scheme": "https",
             "host": "*.example.com"
           },
-          "category": ["LAUNCHER"]
+          "category": ["BROWSABLE", "DEFAULT"]
         }
       ],
```

---

## 4. Frontend-to-Backend Network Connectivity on Physical Phone

### 📌 Summary
Physical phones connected to the app were unable to fetch data or register (`Network Error` / `Timeout`).

### 🔍 Error Details
- Phone sent API requests to `http://192.168.1.36:5000/api`.
- Request failed with `ERR_CONNECTION_REFUSED` / timeout because no server existed at `.36`.

### ⚡ Why It Happened
The host PC's Wi-Fi network interface had IP address **`192.168.1.35`** (determined by `ipconfig`), but [`frontend/.env`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/.env) had an outdated address **`192.168.1.36`**.

> [!NOTE]
> When testing on a physical mobile device, `localhost` refers to the phone itself, not the computer running the backend. The phone must reach the computer via its local Wi-Fi IP address.

### 🛠️ The Fix (Code Diff)
In [`frontend/.env`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/.env#L1):
```diff
-EXPO_PUBLIC_API_URL=http://192.168.1.36:5000/api
+EXPO_PUBLIC_API_URL=http://192.168.1.35:5000/api
```

### 🚀 How to Verify
1. Verify the backend responds over your LAN IP:
   ```bash
   curl http://192.168.1.35:5000/api/health
   # Expected response: {"ok":true,"service":"compare-project-backend",...}
   ```
2. Check that the backend is listening on `0.0.0.0` (all network interfaces), not just `127.0.0.1`.

---

## 5. Phone Connection: `java.io.IOException: Failed to download remote update`

### 📌 Summary
When launching the app on the phone with `npx expo start`, Expo Go showed `Uncaught Error: java.io.IOException: Failed to download remote update`.

### 🔍 Error Details
```text
uncaught error: java.io.IOException: Failed to download remote update
Code: UpdateFailedToLoad
dev.expo.updates: Unexpected error encountered while loading this app
```

### ⚡ Why It Happened (2 Contributing Factors)
1. **Dummy EAS `projectId` in `app.json`**:
   [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json) contained:
   ```json
   "extra": { "eas": { "projectId": "db37ad4f-2232-4d4b-942b-bc4a4aab52c2" } }
   ```
   When an app defines an EAS `projectId`, Expo Go treats it as a cloud-registered EAS app. On startup, Expo Go attempts to contact `u.expo.dev` to verify credentials and download remote updates. Because you are developing locally without an Expo account, Expo Go flags it as an "Unverified App" and crashes with `Failed to download remote update`.
2. **Phone was not connected to the local Wi-Fi**:
   The phone's Wi-Fi was initially turned off (`wlan0: state DOWN`), so requests to `192.168.1.35` were routed over cellular data and timed out.

### 🛠️ The Fix (Code Diff)
1. **Removed dummy `extra.eas.projectId` from [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json#L45-L52)**:
```diff
     "web": {
       "favicon": "./assets/favicon.png"
-    },
-    "extra": {
-      "eas": {
-        "projectId": "db37ad4f-2232-4d4b-942b-bc4a4aab52c2"
-      }
     }
```
2. **Connected phone to `Avodha_5G` Wi-Fi**:
   Now the phone can ping `192.168.1.35` with 0% packet loss.
3. **Set [frontend/.env](file:///d:/Avodah/CompareProjects_Redesigned/frontend/.env)** to:
   ```properties
   EXPO_PUBLIC_API_URL=http://192.168.1.35:5000/api
   ```
4. **Started Metro cleanly with `npx expo start`**:
   Expo bundled all 2,443 modules and loaded the **Home** screen on the phone.

---

## 6. Daily Run Instructions

### Option A: Running over USB Cable (Zero Wi-Fi Dependency)
1. **Connect phone with USB** and enable USB Debugging.
2. **Forward ports**:
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:5000 tcp:5000
   ```
3. **Check `frontend/.env`**:
   ```properties
   EXPO_PUBLIC_API_URL=http://localhost:5000/api
   ```
4. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```
5. **Start Frontend**:
   ```bash
   cd frontend
   npx expo start
   ```
6. In **Expo Go** on your phone, open: `exp://localhost:8081`.

---

### Option B: Running over Wi-Fi (No USB Cable)
1. Connect your phone to the **same Wi-Fi** as your PC (`192.168.1.x`).
2. **Check `frontend/.env`**:
   ```properties
   EXPO_PUBLIC_API_URL=http://192.168.1.35:5000/api
   ```
3. **Start Backend & Frontend**:
   ```bash
   cd backend && npm start
   cd frontend && npx expo start
   ```
4. Scan the QR code in **Expo Go** or open: `exp://192.168.1.35:8081`.

---

## 6. Onboarding Screen ("Step Inside") & Permissions Integration

### 📌 Summary
Added a luxury onboarding screen immediately after the introductory splash animation. Instead of generic "Getting Started" phrasing, the screen introduces the user with the cool luxury tagline **"Step Inside."** and prompts for both **Location** and **Notification** permissions using native Android permission requests.

### 🔍 Requirements & Features
1. **Timing & Flow**: Rendered right after the splash loading animation completes, before entering the main app.
2. **Branding & Copy**:
   - Replaced generic words with:
     - Title: **"Step Inside."**
     - Tagline: *"Discover elite spaces. Compare with clarity."*
     - Badge: `✨ INTELLIGENT DISCOVERY`
   - Glassmorphic card styling, deep violet/plum ambient gradient, and glowing brand monogram tile.
3. **Interactive Permissions**:
   - **Location Access (`ACCESS_FINE_LOCATION`)**: Personalizes nearby properties, commute calculations, and micro-market rates.
   - **Smart Notifications (`POST_NOTIFICATIONS`)**: Alerts for instant price drops, tower launches, and agent replies.
   - Live permission detection: shows interactive **"Enable"** chip that triggers the native Android dialog, then switches to a green **"✓ Enabled"** badge upon approval.
4. **CTA**: Bottom dock button **"Step Inside →"** persists onboarding completion (`cp_has_started = true`) in `AsyncStorage` and smoothly transitions the user into the app.

### 🛠️ Changes Made
- Added permissions to [`frontend/app.json`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/app.json):
  ```json
  "permissions": [
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "POST_NOTIFICATIONS"
  ]
  ```
- Created [`frontend/src/screens/GetStartedScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/GetStartedScreen.js).
- Integrated with [`frontend/App.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/App.js) and streamlined [`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js).

---

## 7. Streamlined App Flow: Direct Transition from "Step Inside" to Login

### 📌 Summary
Removed the intermediary **"Find the right property. Compare before you decide."** screen (`IntentScreen`). The application navigation flow now moves directly:
**Loading Animation (`SplashScreen`) ➔ Get Started Page (`GetStartedScreen` / "Step Inside") ➔ Login Page (`LoginScreen`) ➔ Home Screen (`HomeScreen`)**.

### 🛠️ Changes Made
1. **[`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js)**:
   - Removed `IntentScreen` import and stack screen.
   - Updated `AuthStack` `initialRouteName` from `"Intent"` to `"Login"`.
2. **[`frontend/src/screens/GetStartedScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/GetStartedScreen.js)**:
   - Updated navigation fallback from `"Intent"` directly to `"Login"`.
3. **[`frontend/src/components/ScreenHeader.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/components/ScreenHeader.js)**:
   - Guarded back arrow with `nav.canGoBack()` so root screens like `LoginScreen` do not render a non-functional back button.
4. **[`frontend/src/screens/LoginScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/LoginScreen.js)**:
   - Enhanced `handleSkip` to exchange a valid session with the local backend instead of a mock invalid token.

---

## 8. Luxury Login Redesign, Developer Email/Password Auth, Guest Surfing & Protected Action Dialogs

### 📌 Summary
Completely redesigned the [`LoginScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/LoginScreen.js) following the luxury design system. Added role-tailored authentication:
1. **Developer Profile**: Uses **Corporate Work Email** & **Secure Password** (with builder portal access, email validation, visibility toggle, and fast demo fill).
2. **Owner / Broker Profiles**: Uses **Indian Mobile Number (+91)** with 6-digit OTP verification.
3. **Skip Button**: Allows users to bypass authentication entirely and surf the app as a **Guest User**.
4. **Protected Action Interception**: When a guest attempts to **Post Property** (`+` button) or **Enquire Now** on a property, the app automatically intercepts and displays an interactive luxury **Login Required Dialog** ([`LoginRequiredDialog.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/components/LoginRequiredDialog.js)).

### 🛠️ Architecture & Changes Made
1. **Backend Role & Model Updates**:
   - [`backend/src/models/Signup.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/src/models/Signup.js) & [`backend/src/models/User.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/src/models/User.js): Added `"developer"` to role enum and user models.
   - [`backend/src/controllers/signup-controller.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/src/controllers/signup-controller.js): Auto-provisions and signs in developer accounts directly with `{ email, password }`.
   - [`backend/src/middleware/auth.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/src/middleware/auth.js): Updated `resolveUser` to query both `User` and `SignUpUser` collections.
2. **Auth Context & Guest Mode**:
   - [`frontend/src/context/AuthContext.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/context/AuthContext.js): Added `isGuest` state, `continueAsGuest()`, `openLoginPrompt(options)`, and `closeLoginPrompt()`.
3. **Universal Luxury Login Dialog**:
   - [`frontend/src/components/LoginRequiredDialog.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/components/LoginRequiredDialog.js): Created luxury frosted-glass modal explaining the benefits of signing in, with direct buttons to "Sign In / Register" or "Continue Browsing".
   - Mounted globally in [`frontend/App.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/App.js).
4. **Protected Actions Intercepted**:
   - [`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js): Intercepted the bottom tab `Post Property` button with `tabBarButton` listener — if `!token`, triggers `openLoginPrompt({ reason: "post-property" })`.
   - [`frontend/src/screens/PropertyDetailsScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/PropertyDetailsScreen.js): Intercepted "Enquire Now" button — if `!token`, triggers `openLoginPrompt({ reason: "enquiry" })`.
5. **Screen & Navigation Refactor**:
   - Unified stack in [`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js) so that `Tabs`, `Profile`, and `Login` coexist seamlessly.
   - Updated [`frontend/src/screens/LoginScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/LoginScreen.js) with role selector cards, dynamic Developer vs Owner/Broker forms, quick demo fill helper, and smooth skip handling.
   - Updated [`frontend/src/screens/HomeScreen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/HomeScreen.js) to display user greeting and avatar button that navigates directly to [`ProfileScreen`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/screens/ProfileScreen.js).
   - Updated [`frontend/src/components/Screen.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/components/Screen.js) to use Android-native window resizing instead of forced height compression.

### ✅ Verified on Physical Device (Realme RMX3511)
- **Skip Button**: Instantly enters guest mode and opens the Home Screen tabs.
- **Post Property Guard**: Tapping `+` as guest pops the luxury Login Required modal. Dismissing lets the user keep browsing.
- **Enquiry Guard**: Tapping "Enquire Now" as guest pops the luxury Login Required modal.
- **Developer Login**: Switching to Developer role exposes Corporate Work Email and Password inputs; submitting credentials authenticates with backend and opens developer profile.
- **Authenticated Access**: Once signed in as Developer, tapping `+` opens the "Post your property" listing flow directly.
