                                                                                                                                                                            # Compare Projects – Setup & Deployment Guide

Comprehensive instructions for running **Compare Projects** locally, deploying globally to production, and verifying database connectivity.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [How to Ensure Database Connectivity](#2-how-to-ensure-database-connectivity)
3. [Running the Project Locally](#3-running-the-project-locally)
   - [A. Backend Setup](#a-backend-setup-local)
   - [B. Frontend Setup](#b-frontend-setup-local)
   - [C. Finding your Local LAN IP](#c-finding-your-local-lan-ip)
   - [D. Development Login & OTP](#d-development-login--otp)
4. [Running the Project Globally (Production & Remote)](#4-running-the-project-globally-production--remote)
   - [A. Global / Remote Testing with Tunnels](#a-global--remote-testing-with-tunnels-development)
   - [B. Production Backend Deployment](#b-production-backend-deployment-cloud)
   - [C. Production Mobile App Build (EAS / APK)](#c-production-mobile-app-build-eas--apk)
5. [Database Troubleshooting & Common Issues](#5-database-troubleshooting--common-issues)
6. [Security Best Practices](#6-security-best-practices)

---

## 1. Prerequisites

Before starting, ensure your system has:
* **Node.js**: Version `20.x` or higher (`node -v`)
* **npm**: Version `10.x` or higher (`npm -v`)
* **MongoDB**: A free cloud cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or a local MongoDB instance.
* **Testing Device**:
  * Physical Android or iOS device with the **Expo Go** app installed (from Google Play Store or Apple App Store).
  * *OR* an Android Studio Emulator / iOS Simulator.

---

## 2. How to Ensure Database Connectivity

Use these **4 methods** to guarantee your backend connects to MongoDB properly:

### Method 1: The Built-in Database Check CLI (Recommended)
The backend contains a dedicated, read-only diagnostic script that validates credentials, TLS handshake, database ping, collections, and property count:

```bash
cd backend
npm run check:db
```

* **Expected Success Output:**
  ```text
  Connected to database "realestate". Collection "properties" has 1420 documents.

  Field usage in the first documents:
  title                        200/200
  city                         200/200
  locality                     198/200
  price                        192/200
  ```
* **Failure Output**: If credentials or IP access fail, it prints the exact error:
  * `MongoServerSelectionError: connection timed out` &rarr; Your IP is not whitelisted in MongoDB Atlas.
  * `MongoServerError: bad auth : authentication failed` &rarr; Username or password in `MONGODB_URI` is incorrect.

---

### Method 2: Inspecting Live Backend Startup Logs
When starting the server:
```bash
cd backend
npm start
```
* **Success Output:**
  ```text
  MongoDB connected
  API listening on port 5000 (OTP mode: console)
  ```
* If MongoDB cannot be reached, the server fails fast with `Startup failed: ...` and terminates cleanly without silent hanging.

---

### Method 3: Live Health Check API Endpoint (`/api/health`)
Once the server is running, query the live health check endpoint:

* **Using Terminal / cURL:**
  ```bash
  curl http://localhost:5000/api/health
  ```
* **Using Web Browser:** Open [http://localhost:5000/api/health](http://localhost:5000/api/health)
* **Expected JSON Response:**
  ```json
  {
    "ok": true,
    "service": "compare-project-backend",
    "database": "connected",
    "databaseState": 1,
    "time": "2026-10-27T11:20:00.000Z"
  }
  ```
  *(Note: `databaseState: 1` confirms an active, healthy Mongoose connection).*

---

### Method 4: Real Data Query Check (`/api/properties`)
Verify that documents can be queried and normalized from the database:
```bash
curl "http://localhost:5000/api/properties?limit=1"
```
If this returns a JSON object with `"items": [...]`, your database connection and query pipelines are working.

---

## 3. Running the Project Locally

### A. Backend Setup (Local)

1. Open a terminal and navigate to `backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
4. Edit `backend/.env` with your values:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/realestate?retryWrites=true&w=majority
   MONGODB_COLLECTION=properties
   JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
   ADMIN_PHONES=9876543210
   OTP_MODE=console
   ```
5. Verify your database connection:
   ```bash
   npm run check:db
   ```
6. Start the backend:
   ```bash
   npm start
   # Or for auto-reload during development:
   npm run dev
   ```

---

### B. Frontend Setup (Local)

1. Open a **second terminal** and navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
4. Set `EXPO_PUBLIC_API_URL` in `frontend/.env` depending on how you run the app:

   | Test Environment | `EXPO_PUBLIC_API_URL` in `frontend/.env` |
   |---|---|
   | **Physical Phone (Same Wi-Fi)** | `http://<YOUR_PC_LAN_IP>:5000/api` *(e.g. `http://192.168.1.34:5000/api`)* |
   | **Android Studio Emulator** | `http://10.0.2.2:5000/api` |
   | **USB Cable via ADB Reverse** | `http://localhost:5000/api` *(run: `adb reverse tcp:5000 tcp:5000`)* |
   | **Web Browser** | `http://localhost:5000/api` |

5. Start the Expo development server:
   ```bash
   npx expo start -c
   ```
6. Launch on your device:
   * **Physical Android / iPhone**: Open **Expo Go**, scan the QR code displayed in the terminal.
   * **Android Emulator**: Press `a` in the Expo terminal.
   * **Web Browser Preview**: Press `w` in the Expo terminal.

---

### C. Finding your Local LAN IP
When running on a physical phone over Wi-Fi, your phone must be able to reach your PC's IP address:
* **Windows (PowerShell/CMD):**
  ```powershell
  ipconfig
  ```
  Look for **IPv4 Address** under your active Wi-Fi adapter (e.g., `192.168.1.34`).
* **macOS / Linux:**
  ```bash
  ifconfig | grep "inet "
  ```
> **Tip:** Ensure your Windows Firewall or anti-virus is not blocking incoming connections on port `5000`.

---

### D. Development Login & OTP
* When you enter any 10-digit phone number in the app, the OTP is generated in **console mode** during development.
* Check your **backend terminal window** — the 6-digit OTP will be printed directly in the terminal logs:
  ```text
  [DEV OTP] Phone: 9876543210  OTP: 123456
  ```
* Enter that code in the mobile app to sign in.

---

## 4. Running the Project Globally (Production & Remote)

### A. Global / Remote Testing with Tunnels (Development)
If you want to test the app on a physical phone from anywhere (different Wi-Fi networks, 4G/5G mobile data) without deploying to the cloud:

1. **Expose the backend globally using ngrok:**
   ```bash
   npx ngrok http 5000
   ```
   Copy the generated HTTPS URL: `https://<random-id>.ngrok-free.app`.
2. **Update `frontend/.env`:**
   ```env
   EXPO_PUBLIC_API_URL=https://<random-id>.ngrok-free.app/api
   ```
3. **Start Expo with Tunnel mode:**
   ```bash
   npx expo start --tunnel -c
   ```
   Now you can scan the QR code from anywhere in the world.

---

### B. Production Backend Deployment (Cloud)

You can deploy the backend to cloud platforms like **Render**, **Railway**, **AWS EC2**, or **DigitalOcean**.

#### Example: Deploying to Render / Railway
1. **Repository**: Push your code to GitHub / GitLab.
2. **Root Directory**: Set build/run context to `backend/`.
3. **Build Command**:
   ```bash
   npm install
   ```
4. **Start Command**:
   ```bash
   npm start
   ```
5. **Set Production Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/realestate?retryWrites=true&w=majority
   MONGODB_COLLECTION=properties
   JWT_SECRET=<generate_a_cryptographically_secure_random_64_character_string>
   ADMIN_PHONES=9876543210
   CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
   OTP_MODE=twilio
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. **MongoDB Atlas Whitelist:**
   In your MongoDB Atlas Dashboard:
   * Go to **Network Access** &rarr; **IP Access List**.
   * Add the static outbound IP of your hosting service, or add `0.0.0.0/0` (Allow access from anywhere with password authentication).

---

### C. Production Mobile App Build (EAS / APK)

To generate standalone distributable APK / AAB files for Android and IPA for iOS:

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log into your Expo account:
   ```bash
   eas login
   ```
3. Initialize build configuration:
   ```bash
   cd frontend
   eas build:configure
   ```
4. Configure production API URL in `frontend/.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
   ```
5. **Build Standalone Android APK (for direct installation / testing):**
   ```bash
   eas build --platform android --profile preview
   ```
6. **Build Android App Bundle (for Google Play Store):**
   ```bash
   eas build --platform android --profile production
   ```

---

## 5. Database Troubleshooting & Common Issues

| Error Message | Cause | Resolution |
|---|---|---|
| `MongoServerSelectionError: connection timed out` | MongoDB Atlas firewall is blocking your IP address. | 1. Go to [MongoDB Atlas](https://cloud.mongodb.com/).<br>2. Select **Network Access** &rarr; **IP Access List**.<br>3. Click **Add IP Address**.<br>4. Choose **Allow Access from Anywhere (`0.0.0.0/0`)** and save. |
| `MongoServerError: bad auth : authentication failed` | Username or password in `MONGODB_URI` is wrong. | 1. Go to **Database Access** in Atlas.<br>2. Verify or reset the user's password.<br>3. If the password has special characters (`@`, `:`, `/`, `#`), URL-encode them (`@` &rarr; `%40`). |
| `ENOTFOUND` or DNS timeout | Node.js DNS resolution issues on Windows / certain ISPs. | The server already includes `dns.setServers(["1.1.1.1", "8.8.8.8"])` in `src/server.js` to ensure fast Cloudflare/Google DNS resolution. |
| Query returns 0 documents | Incorrect collection name or database name. | Ensure `MONGODB_COLLECTION=properties` in `.env` matches your Atlas collection name. Run `npm run check:db` to see the exact collection document counts. |

---

## 6. Security Best Practices

* **Never commit `.env` files**: Ensure `.env` is listed in `.gitignore`.
* **Rotate database credentials**: If a connection string was ever shared or exposed, immediately rotate the password in MongoDB Atlas.
* **Strong JWT Secret**: In production, use a strong, unpredictable `JWT_SECRET` (minimum 32 characters).
* **Production OTP**: Always switch from `OTP_MODE=console` to `OTP_MODE=twilio` in production environments.
