# Test cases & results

Legend: ✅ passed automatically · 🔶 covered with an in-memory database only (re-run against your Atlas with `npm run check:db` + manual test) · 📱 manual – must be done on your phone/emulator · ⛔ not possible in the build environment

## A. Automated – backend (`cd backend && npm test`) → **52 / 52 passed**
The suite starts the real Express app on a random port and calls it over HTTP. Mongoose models are replaced by a small in-memory implementation (`test/helpers/fakeDb.js`), so MongoDB query *syntax* is not executed by a real server (🔶).

| # | Case | Result |
|---|---|---|
| 1 | Server refuses to start without `MONGODB_URI` | ✅ |
| 2 | Production refuses weak JWT secret / development OTP mode | ✅ |
| 3 | Unreachable MongoDB fails fast, no secret in output | ✅ |
| 4 | Health endpoint | ✅ |
| 5 | Unknown route → JSON 404; invalid JSON → 400 | ✅ |
| 6 | Send OTP; invalid phone (many shapes incl. NoSQL object) | ✅ |
| 7 | OTP hashed at rest, single-use, bound to phone | ✅ |
| 8 | Resend cooldown (429) | ✅ |
| 9 | Verify OTP: wrong → 401, malformed → 400, expired → 401, lock after 5 tries | ✅ |
| 10 | Twilio mode sends SMS and never returns the OTP | ✅ |
| 11 | User creation on first login; JWT: none / garbage / valid | ✅ |
| 12 | Profile update; role cannot be self-assigned; broker purpose → broker role | ✅ |
| 13 | Disabled account loses access immediately | ✅ |
| 14 | Empty database: lists, categories, top-rated return empty arrays | ✅ 🔶 |
| 15 | Property list, normalisation of varied field names, no invented values | ✅ 🔶 |
| 16 | Search (title/city/locality/developer/type), regex-injection safe | ✅ 🔶 |
| 17 | Filters (city, BHK, price, type, possession, developer, featured, area), sort, pagination | ✅ 🔶 |
| 18 | New Project categories only counted from real data | ✅ 🔶 |
| 19 | Property details; invalid id → 400; missing → 404; pending hidden | ✅ |
| 20 | Compare endpoint (order, max 4, invalid ids) | ✅ |
| 21 | Save / unsave / toggle / saved list / per-user isolation / unauthenticated | ✅ |
| 22 | Post property: auth, per-field validation, manual + pending, mass-assignment ignored, plots without BHK | ✅ |
| 23 | Enquiry: stores user, phone, property, title, message, source; my enquiries | ✅ |
| 24 | Ratings: validation, create, update (1 per user), summary math, public read without identity leak, delete, own-listing block, card rating, top-rated, sort=rating | ✅ |
| 25 | Admin APIs: anonymous 401, user 403, bad token 401, broker 403 | ✅ |
| 26 | Admin: stats, users, properties incl. hidden, approve/reject, enquiries workflow, delete review | ✅ |
| 27 | Superadmin-only: roles, disable, delete (imported data protected), cannot change own role; promotion/demotion immediate | ✅ |

## B. Automated – frontend (`cd frontend && npm test`) → **8 / 8 passed**
Price/phone formatting, phone & OTP-paste validation, post-form validation mirroring the server, API-error mapping (offline / timeout / 5xx), compare table logic (N/A, hidden empty rows, lowest price).

## C. Compile check
`npm run bundle:check` (Expo/Metro, Android) → ✅ 970 modules bundled, 2.1 MB JS, no unresolved imports or syntax errors. Hermes byte-code generation was skipped (⛔ the executable bit of `hermesc` was lost in the uploaded ZIP; it works after a normal `npm install`).

## D. Not run in the build environment
| Item | Status |
|---|---|
| Connection to **your** MongoDB Atlas and your real property documents | ⛔ no network → run `npm run check:db` |
| `npx expo-doctor`, `npx expo install --check` | ⛔ need network; no dependency was added or upgraded versus your ZIP |
| `eas build` / `expo run:android` / APK install | ⛔ |
| Comparing with the reference website (it is a client-rendered app, nothing readable without JavaScript) | ⛔ |
| Real SMS through Twilio | ⛔ (code path unit-tested with a stub) |

## E. Manual device checklist 📱 (please tick on your phone)
- [ ] Splash animation plays once, then Welcome appears
- [ ] Intent cards animate and select; Get Started → Login
- [ ] Invalid mobile (5 digits, starts with 5) shows message and blocks Send OTP
- [ ] OTP boxes: auto-advance, numeric keyboard, paste 6 digits, backspace
- [ ] Wrong OTP → red boxes + shake, boxes clear; correct OTP → green boxes + check mark
- [ ] Resend disabled during countdown, enabled after; Change number works
- [ ] Purpose screen saves; welcome animation → Home
- [ ] Home loads real listings; pull-to-refresh; city selector; rails hide when empty
- [ ] Search + filters sheet + sort + clear; result count
- [ ] Compare: add 2–4 from cards, remove, N/A cells, horizontal scroll
- [ ] Property details: swipe gallery, save heart animation, compare, share, Enquire Now
- [ ] Rate a property (stars bounce), edit, remove; average appears on the card
- [ ] Post Property: validation errors, submit, success animation, appears in My properties as “Pending review”
- [ ] Admin number: dashboard visible; approve the post → it appears on Home
- [ ] Normal number: no admin entry anywhere
- [ ] New Project tab shows only categories that have data
- [ ] Saved list, My enquiries, Settings save, Logout
- [ ] Stop backend → friendly error + Retry on each tab
- [ ] Android back button on every screen and inside sheets
- [ ] Keyboard never hides inputs (login, OTP, post form, enquiry, review)
- [ ] Small (≈5") and large (≈6.7") screens: no clipping; bottom bar clear of the system navigation bar
