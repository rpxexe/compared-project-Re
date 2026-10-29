# Solutions & Root Cause Analysis

This document provides a complete explanation of why the database connection and app navigation issues occurred, how each has been resolved, and how to verify and prevent them in the future.

---

## 1. Summary of Identified Root Causes

When testing the app, three distinct issues occurred:

| # | Error / Symptom | Root Cause | Status |
|---|---|---|---|
| **1** | **App on phone could not reach API / Properties not loading** | **IP Mismatch**: The PC's Wi-Fi IP address changed from `192.168.1.34` to `192.168.1.36`. The frontend configuration was pointing to the old IP `192.168.1.34:5000`, causing network timeouts on the physical device. | **FIXED** |
| **2** | `ERROR The action 'NAVIGATE' with payload {"name":"NewProject"} was not handled by any navigator` | **Missing Route**: When the bottom tabs were restructured to 5 tabs (`Home`, `Explore`, `Post`, `Compare`, `Profile`), `NewProject` was removed from the tab bar but had not been registered in `Stack.Navigator`. | **FIXED** |
| **3** | `Connection failed: querySrv ESERVFAIL _mongodb._tcp.compareprojectcluster0.1lha77m.mongodb.net` | **Router DNS SRV Block**: Local router DNS (`192.168.1.1`) fails to resolve MongoDB Atlas `mongodb+srv://` SRV records, returning `ESERVFAIL`. | **FIXED** |

---

## 2. Solutions Implemented in Code

### Solution 1: Fix Frontend API IP Address
* **Problem**: The mobile device (running Expo Go) makes network requests over local Wi-Fi to your PC. Because the PC's Wi-Fi IP changed to `192.168.1.36`, requests sent to `192.168.1.34` resulted in a connection timeout.
* **Fix Applied**:
  1. Updated [`frontend/.env`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/.env):
     ```env
     EXPO_PUBLIC_API_URL=http://192.168.1.36:5000/api
     ```
  2. Updated fallback URL in [`frontend/src/services/api.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/services/api.js) to `http://192.168.1.36:5000/api`.

---

### Solution 2: Fix `NewProject` Navigator Error
* **Problem**: When tapping on "New Launches", "AR Tour", or navigating to `NewProject`, React Navigation crashed because `NewProject` was not in `Stack.Navigator`.
* **Fix Applied**:
  Registered `NewProject` in [`frontend/src/navigation/AppNavigator.js`](file:///d:/Avodah/CompareProjects_Redesigned/frontend/src/navigation/AppNavigator.js):
  ```javascript
  <Stack.Screen name="Tabs" component={Tabs} options={{ animation: "fade" }} />
  <Stack.Screen name="Search" component={SearchScreen} />
  <Stack.Screen name="NewProject" component={NewProjectScreen} />
  <Stack.Screen name="Notification" component={NotificationScreen} />
  ```
  Now, all buttons and navigation actions to `NewProject` resolve cleanly.

---

### Solution 3: Resolve MongoDB Atlas DNS SRV (`ESERVFAIL`)
* **Problem**: Many home Wi-Fi routers (at `192.168.1.1`) do not support or actively block DNS SRV lookup queries (`_mongodb._tcp...`), returning `ESERVFAIL`.
* **Fix Applied**:
  1. **Public DNS Overrides**: Added Cloudflare (`1.1.1.1`) and Google (`8.8.8.8`) DNS server configuration in [`backend/src/config/db.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/src/config/db.js) and [`backend/scripts/check-db.js`](file:///d:/Avodah/CompareProjects_Redesigned/backend/scripts/check-db.js).
  2. **Direct Replica Set Fallback**: If SRV lookup fails, `db.js` retries with the non-SRV replica set string from `MONGODB_FALLBACK_URI` in `backend/.env` (never commit credentials). Format:
     ```text
     mongodb://<user>:<password>@ac-dhqev0g-shard-00-00.1lha77m.mongodb.net:27017,ac-dhqev0g-shard-00-01.1lha77m.mongodb.net:27017,ac-dhqev0g-shard-00-02.1lha77m.mongodb.net:27017/comparedb?ssl=true&replicaSet=atlas-72j8y4-shard-0&authSource=admin&retryWrites=true&w=majority
     ```
  3. **Verification**: Executed `npm run check:db`. Output confirmed:
     ```text
     Connected to database "comparedb". Collection "properties" has 8451 documents.
     ```

---

## 3. How to Restart and Verify Everything Now

### Step 1: Restart the Backend
If your backend is still running the old process, stop it with `Ctrl + C` in the backend terminal, then run:
```bash
cd backend
npm start
```
You should see:
```text
MongoDB connected
API listening on port 5000 (OTP mode: development)
```

### Step 2: Verify Backend & Database from your Browser or Terminal
Open your web browser or run:
```bash
curl http://localhost:5000/api/health
```
**Expected Response:**
```json
{
  "ok": true,
  "service": "compare-project-backend",
  "database": "connected",
  "databaseState": 1,
  "time": "2026-10-27T11:30:00.000Z"
}
```

Then check properties:
```bash
curl "http://localhost:5000/api/properties?limit=2"
```
You will receive live real estate listings from `comparedb` (`8,451` total documents).

### Step 3: Restart Expo Frontend
In your frontend terminal, stop Expo with `Ctrl + C`, then start with a fresh cache:
```bash
cd frontend
npx expo start -c
```
Scan the QR code with **Expo Go**. The app will connect directly to `http://192.168.1.36:5000/api` and display live properties and location fetching without navigation crashes.

---

## 4. Quick Checklist if your Wi-Fi IP Changes in the Future

Whenever you disconnect from Wi-Fi or restart your router, your PC may be assigned a new local IP:
1. Run `ipconfig` in PowerShell/CMD and look at **IPv4 Address** under `Wireless LAN adapter Wi-Fi`.
2. If the IP is different from `192.168.1.36`, update `EXPO_PUBLIC_API_URL` in `frontend/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://<YOUR_NEW_IP>:5000/api
   ```
3. Restart Expo with `npx expo start -c`.
