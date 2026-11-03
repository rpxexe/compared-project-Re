# CRM REST API — Admin & Super Admin

REST contract between the **CompareProjects backend** (`backend/`, Express + MongoDB) and the
**CRM**. Only staff with the `admin` or `superadmin` role can use it.

The mobile app has no admin screens any more: all staff work happens in the CRM through
`/api/crm/*`. The old `/api/admin/*` routes have been removed.

Contents: [1. Conventions](#1-conventions) · [2. Authentication](#2-authentication) ·
[3. Dashboard](#3-dashboard) · [4. Leads](#4-leads) · [5. Properties](#5-properties) ·
[6. Customers and staff](#6-customers-and-staff) · [7. Notifications, audit log and settings](#7-notifications-audit-log-and-settings) ·
[8. Operations](#8-operations) · [9. Quick reference](#9-quick-reference)

---

## 1. Conventions

### 1.1 Base URL

```
https://<api-host>/api/crm
```

Add the CRM's web origin to `CORS_ORIGINS` in `backend/.env`.

### 1.2 Authentication and roles

Every request needs a JWT from one of the login endpoints in §2:

```
Authorization: Bearer <token>
```

The server checks the token **and** reads the role from MongoDB on every request. Demoting or
deactivating someone therefore takes effect immediately, even if their token hasn't expired.

| Role | Access |
|------|--------|
| `admin` | Reads everything. Works leads, moderates and posts listings, removes reviews, notifies customers. Can only assign leads to **themselves**. |
| `superadmin` | Everything an admin can do, plus: assign leads to anyone, delete leads and listings, change user roles and block users, manage staff, export, audit log, change settings. |

In this document, **🔒** marks super-admin-only endpoints. An admin calling one gets `403`.

### 1.3 Request and response format

- Bodies are JSON (`Content-Type: application/json`, 200 KB max). Image uploads use `multipart/form-data`.
- All IDs are strings. **Property IDs can be a 24-character ObjectId or a 20–32 character hex
  string** (imported listings), so treat them as opaque.
- Dates are ISO-8601 UTC strings (`2026-11-03T10:15:00.000Z`). Inputs accept anything `new Date()` can parse.
- "Today" and day boundaries follow India time (UTC+05:30).
- Prices are numbers in ₹, and areas are in sq.ft.

### 1.4 Pagination

Lists accept `page` (default 1) and `limit` (default 20, max 50; the audit log allows up to 100):

```json
{ "items": [ ... ], "total": 1342, "page": 1, "limit": 20 }
```

### 1.5 Errors

```json
{ "message": "Please fix the highlighted fields", "errors": { "phone": "Enter a valid 10-digit mobile number" } }
```

| Status | When |
|--------|------|
| `400` | Validation failed or the ID is invalid. `errors` holds per-field messages when available. |
| `401` | Token is missing, expired or invalid, or the account is disabled |
| `403` | Signed in, but the role doesn't allow this |
| `404` | Record not found |
| `409` | Duplicate, e.g. the email already exists or the lead already exists |
| `429` | Rate limit reached. Read the `Retry-After` header. |
| `500` | Server error (generic message) |

**Rate limits:** 300 requests per minute per staff member across `/api/crm`, and 5 exports per hour.

### 1.6 Audit

Every CRM write (create, update, assign, delete, export, notify, password change, settings change)
is written to the audit log with who made the change and what changed (§7.2). Passwords are never logged.

---

## 2. Authentication

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/auth/signin` | anyone |
| POST | `/api/auth/send-otp`, `/api/auth/verify-otp` | anyone |
| GET | `/api/crm/me` | staff |
| POST | `/api/crm/me/password` | staff with an email account |

There are two kinds of staff account:
- **Email accounts:** created in the CRM with `POST /api/crm/staff`. They sign in with email and password.
- **Phone accounts:** sign in with an OTP. Numbers listed in `ADMIN_PHONES` or `SUPERADMIN_PHONES`
  in `backend/.env` get that role when they log in. This is how the first super admin is created.

### POST `/api/auth/signin`
```json
// request ({ "data": { … } } is also accepted)
{ "email": "ops@avodahgroup.co", "password": "••••••••" }
// 200
{ "message": "Signed in successfully", "token": "<jwt>",
  "user": { "id": "…", "fullName": "Ops", "email": "…", "phone": "…", "role": "admin" } }
```
Errors: `401` wrong email or password · `403` account disabled · `429` more than 30 attempts per IP or 8 per account in 15 minutes.

### POST `/api/auth/send-otp` → `/api/auth/verify-otp`
`{ "phone": "9876543210" }` → `{ "phone": "…", "otp": "123456" }` → `{ token, user, isNewUser }`.

### GET `/api/crm/me`
Call this right after login. A customer's token gets **403**, which keeps customers out of the CRM.
```json
{
  "user": { "id": "…", "name": "Ops", "fullName": "Ops", "phone": "", "email": "ops@…", "role": "superadmin",
            "purpose": "", "city": "", "accountType": "email", "isActive": true, "createdAt": "…", "lastLoginAt": "…" },
  "permissions": ["leads:read", "leads:write", "leads:assign:any", "leads:delete", "properties:moderate",
                  "properties:create", "properties:delete", "reviews:delete", "users:read", "users:manage",
                  "staff:manage", "export", "audit:read", "settings:write"]
}
```
An admin's `permissions` are `leads:read`, `leads:write`, `leads:assign:self`, `properties:moderate`,
`properties:create`, `reviews:delete` and `users:read`. Use the list to show or hide UI. The server
enforces every rule regardless.

### POST `/api/crm/me/password`
`{ "currentPassword": "…", "newPassword": "…" }` → `{ "message": "Password updated" }`.
Errors: `401` the current password is wrong · `400` the new password isn't 8–128 characters, or this is a phone (OTP) account.

---

## 3. Dashboard

### GET `/api/crm/stats`
```json
{
  "users": 5120, "properties": 18420, "manualProperties": 312, "pendingApprovals": 14,
  "enquiries": 980, "newEnquiries": 22, "reviews": 641, "views": 9300,
  "leads": {
    "total": 4310,
    "byStatus": { "new": 120, "contacted": 340, "qualified": 95, "site_visit": 40, "negotiation": 18, "won": 61, "lost": 210 },
    "unassigned": 77, "followUpsDueToday": 19, "overdueFollowUps": 6
  },
  "myLeads": { "open": 34, "followUpsDueToday": 5 }
}
```
`users` counts both phone and email accounts. `unassigned`, `followUpsDueToday` and `overdueFollowUps` only count open leads (not won or lost).

### GET `/api/crm/stats/trends`
| Query | Values |
|-------|--------|
| `metric` | `leads` (default), `enquiries`, `users`, `properties`, `views` |
| `from`, `to` | Defaults to the last 30 days. The range can be at most 2 years. |
| `interval` | `day` (default), `week` (the key is that week's Monday), `month` (key `YYYY-MM`) |
| `groupBy` | leads: `source`, `status`, `city` · enquiries: `status` · users: `city` · properties: `status`, `city` · views: `city` |

```json
{ "metric": "leads", "interval": "day", "from": "…", "to": "…", "groupBy": "source",
  "points": [ { "date": "2026-11-01", "value": 42, "groups": { "enquiry": 12, "view": 30 } } ] }
```
Empty days are included with `value: 0`.

### GET `/api/crm/stats/staff-performance` 🔒
Accepts `from` and `to` to filter on lead creation date.
```json
{ "items": [ { "staffId": "…", "name": "Neha", "role": "admin", "isActive": true, "assigned": 40, "contacted": 31,
               "won": 6, "lost": 9, "avgFirstResponseMinutes": 48, "overdueFollowUps": 2 } ] }
```
`avgFirstResponseMinutes` is the average time from a lead being created to its first move out of
`new`. It is `null` when no lead has a response yet.

---

## 4. Leads

### 4.1 Data model

There is **one lead per (customer, listing)**, stored in `crm_leads`. Leads are created and updated
automatically when something happens in the app:

| App event | What happens to the lead |
|-----------|--------------------------|
| `POST /api/enquiries` | The lead is created or updated. `enquiry` is added to `sources`, the enquiry is linked, `priority` becomes `hot`, and an `enquiry` activity is logged. A `lost` lead is **reopened** as `new`. The assignee is notified, or every super admin if the lead is unassigned. |
| `POST /api/properties/:id/view` (signed in) | `viewCount` is updated. A lead is only created once the customer has viewed the listing `leads.viewThreshold` times (default 1). |
| `POST /api/properties/:id/save` | `saved` is added to `sources`. |
| `POST /api/v2/customerActivity/toggle-heart/:id` (hearting) | Same as saving: `saved` is added to `sources`. |
| `POST /api/v2/leads/customer` (contact form, public) | Source `form`, `priority: "hot"`, and an `enquiry` activity with the message, budget, location and loan interest. If the phone number matches an app account and a listing is given, the form joins that customer's lead for the listing. Otherwise a separate lead is created. |

Staff can also create leads by hand (`POST /leads`). These can exist without an app account or a listing.

**Lead object** (returned by every lead endpoint):
```json
{
  "id": "6727…", "status": "contacted", "priority": "hot", "score": 76,
  "name": "Rahul S", "phone": "9876543210", "email": "", "city": "Pune", "purpose": "buyer",
  "user": "6711…",
  "property": { "id": "a3f9…", "title": "2 BHK in Baner", "location": "Baner, Pune", "price": "₹ 1.2 Cr" },
  "sources": ["view", "enquiry"], "primarySource": "view", "viewCount": 7, "enquiryCount": 1,
  "assignedTo": { "id": "…", "name": "Neha" }, "assignedAt": "…",
  "nextFollowUpAt": "2026-11-04T05:30:00.000Z", "lostReason": "",
  "budgetMin": 9000000, "budgetMax": 13000000, "tags": ["vip"],
  "lastActivityAt": "…", "createdAt": "…", "updatedAt": "…"
}
```
`user` is `null` when the lead has no app account. `property` is `null` when the lead has no listing.
`assignedTo` is `null` when the lead is unassigned.

| Field | Values |
|-------|--------|
| `status` | `new` → `contacted` → `qualified` → `site_visit` → `negotiation` → `won` \| `lost`. Staff can move a lead in any direction. |
| `priority` | `hot`, `warm`, `cold` |
| `sources` | `enquiry`, `view`, `saved`, `manual`, `call`, `walk_in`, `website`, `form` (contact form via `POST /api/v2/leads/customer`, see `MOBILE_API.md`) |

**Score (0–100)** is read-only and recalculated whenever the lead changes. With the default weights
(changeable in settings): having an enquiry +40, each view +3 (up to 10 views), saved +10, customer
purpose `buyer` or `investor` +10, activity in the last 7 days +10.

**Keeping enquiries in sync:** when a lead's status changes, its linked enquiries are updated so the
enquiry list stays consistent. `new` → `new`; `won` or `lost` → `closed`; every other status → `contacted`.

### 4.2 Endpoints

| Method | Path | Who |
|--------|------|-----|
| GET | `/leads` | staff |
| POST | `/leads` | staff |
| GET | `/leads/:id` | staff |
| PATCH | `/leads/:id` | staff |
| DELETE | `/leads/:id` | 🔒 |
| POST | `/leads/:id/assign` | staff (see rules) |
| POST | `/leads/bulk` | staff (`delete` 🔒) |
| GET / POST | `/leads/:id/activities` | staff |
| PATCH / DELETE | `/leads/:id/activities/:activityId` | the author, or 🔒 |
| GET | `/follow-ups` | staff |
| GET | `/leads/export` | 🔒 |

### GET `/api/crm/leads`
| Query | Description |
|-------|-------------|
| `search` | Matches name, phone, email or property title |
| `status`, `source`, `priority` | Comma-separated lists, e.g. `status=new,contacted` |
| `assignedTo` | A staff ID, `me`, or `unassigned` |
| `propertyId`, `userId` | Leads for one listing or one customer |
| `city` | Matches the customer's city or the listing's location |
| `followUp` | `overdue` (before now), `today`, `upcoming` (after now), `none`. Every value except `none` only returns open leads. |
| `from`, `to`, `dateField` | Date range on `createdAt` (default) or `lastActivityAt` |
| `minScore` | 0–100 |
| `sort` | `-lastActivityAt` (default), `-createdAt`, `nextFollowUpAt`, `-score`, `-viewCount` |

Returns `{ items: Lead[], total, page, limit }`.

### GET `/api/crm/leads/:id`
```json
{
  "lead": { …Lead },
  "customer": { …user, "accountType": "phone", "isActive": true, "savedCount": 4, "listingCount": 1 },
  "property": { …normalised listing, "approvalStatus": "approved" },
  "enquiries": [ { "id": "…", "message": "Is it available?", "status": "contacted", "createdAt": "…" } ],
  "otherLeads": [ { "id": "…", "propertyTitle": "…", "status": "new", "lastActivityAt": "…" } ],
  "recentActivities": [ …Activity (last 10) ]
}
```
`customer` and `property` are `null` when the lead has no account or listing.

### POST `/api/crm/leads`
Creates a lead by hand, e.g. from a phone call or a walk-in.
```json
{
  "phone": "9876543210",                 // required, 10-digit Indian mobile number
  "name": "Priya K", "email": "", "city": "Mumbai", "purpose": "investor",
  "propertyId": "a3f9…",                 // optional
  "source": "call",                      // manual (default) | call | walk_in | website
  "priority": "warm",                    // default warm
  "budgetMin": 8000000, "budgetMax": 12000000,
  "assignedTo": "me",                    // optional; admins may only use "me" or their own id
  "nextFollowUpAt": "2026-11-05T06:00:00.000Z",
  "note": "Wants sea-facing, ready possession"   // saved as a note activity
}
```
→ `201 { "lead": Lead }`. If the phone number belongs to an app account, the lead is linked to that
account and missing contact details are filled in from it. If that customer already has a lead for
the same listing, the response is `409 { "message": "…", "existingLeadId": "…" }`.

### PATCH `/api/crm/leads/:id`
Partial update. Accepted fields:

| Field | Rules |
|-------|-------|
| `status` | One of the statuses above. Moving to `lost` requires `lostReason` (free text, up to 100 characters; suggested values come from `settings.leads.lostReasons`). |
| `priority` | `hot`, `warm` or `cold` |
| `nextFollowUpAt` | A date, or `null` to clear it |
| `budgetMin`, `budgetMax` | Numbers ≥ 0, or `null`. `budgetMin` can't be more than `budgetMax`. |
| `tags` | Replaces the list. Stored lowercase, up to 20 tags of 30 characters each. |
| `name`, `email`, `city` | Contact details |

A status change logs a `status_change` activity and syncs the linked enquiries. Returns `{ "lead": Lead }`.

### POST `/api/crm/leads/:id/assign`
Body: `{ "assignedTo": "<staffId>" | "me" | null }`
- **Admin:** can take a lead (`"me"`) or release it (`null`), but only when it is currently assigned to them. Anything else returns `403`.
- **Super admin:** can assign to any **active** staff member (otherwise `400`) or unassign.
- Logs an `assignment` activity, and notifies the new assignee unless they assigned it to themselves.

### POST `/api/crm/leads/bulk`
```json
{ "ids": ["…"], "action": "assign" | "status" | "priority" | "tag" | "delete", "value": "…", "lostReason": "…" }
```
Up to 200 IDs. `value` depends on the action: a staff ID, `"me"` or `null` (assign); a status (status);
a priority (priority); a tag to add (tag). Each lead follows the same rules as the single-lead
endpoints, and `delete` is 🔒. Returns `{ "updated": 48, "failed": [{ "id": "…", "message": "…" }] }`.

### DELETE `/api/crm/leads/:id` 🔒
Deletes the lead and its activities. → `{ "deleted": true }`.

### Activities (the lead's timeline)
**Activity object:**
```json
{ "id": "…", "lead": "…", "type": "call", "body": "Wants a visit", "outcome": "connected",
  "scheduledAt": null, "completedAt": null, "durationSeconds": 120, "meta": {},
  "createdBy": { "id": "…", "name": "Neha" }, "createdAt": "…" }
```
| `type` | Written by |
|--------|------------|
| `note`, `call`, `whatsapp`, `email`, `sms`, `site_visit`, `meeting` | Staff |
| `status_change`, `assignment`, `enquiry`, `view`, `system` | The server. `meta` holds the details, e.g. `{ from, to }`. These can't be edited. |

`outcome` is one of `connected`, `no_answer`, `busy`, `wrong_number` or `""`.

**GET `/leads/:id/activities`**: newest first, paginated. Accepts `type` as a comma-separated list.

**POST `/leads/:id/activities`**
```json
{ "type": "call", "outcome": "connected", "body": "Interested, wants site visit Sat",
  "durationSeconds": 240, "scheduledAt": null, "completedAt": null,
  "nextFollowUpAt": "2026-11-08T05:30:00.000Z" }
```
- `type` is required and must be a staff type. A `note` must have a `body` (up to 2000 characters).
- `nextFollowUpAt` (optional) also updates the lead.
- Logging a `call`, `whatsapp`, `email` or `sms` on a `new` lead moves it to `contacted`.
- A `site_visit` or `meeting` with `scheduledAt` set and no `completedAt` appears in `/follow-ups`.

→ `201 { "activity": Activity, "lead": Lead }`.

**PATCH or DELETE `/leads/:id/activities/:activityId`**: only the author or a super admin can do
this, and only for staff types. PATCH accepts `body`, `outcome`, `scheduledAt`, `completedAt` and
`durationSeconds`. To mark a site visit done, set `completedAt`.

### GET `/api/crm/follow-ups`
The CRM's "my day" view.

| Query | Values |
|-------|--------|
| `when` | `today` (default), `overdue`, `week` (today plus the next 6 days), `range` (requires `from` and `to`) |
| `assignedTo` | `me` (the default for admins), `all` (the default for super admins), or a staff ID |

```json
{ "leads":  [ …Lead with nextFollowUpAt in the window, soonest first ],
  "visits": [ { …Activity, "leadName": "…", "leadPhone": "…", "propertyTitle": "…" } ] }
```
Only open leads are included. `visits` lists scheduled site visits and meetings that aren't completed yet.

### GET `/api/crm/leads/export` 🔒
Accepts the same filters and `sort` as `GET /leads`, plus `format=csv` (default) or `json`. Returns
up to 10,000 rows as a download (`Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`).

CSV columns: `id, status, priority, score, name, phone, email, city, purpose, propertyId, propertyTitle,
propertyLocation, sources, viewCount, enquiryCount, assignedTo, nextFollowUpAt, lostReason, budgetMin,
budgetMax, tags, lastActivityAt, createdAt`. Lists are joined with `|`. A cell that starts with
`= + - @` gets a `'` in front so spreadsheet apps don't run it as a formula. Every export is audited
and limited to 5 per hour.

### Raw lead sources
**GET `/api/crm/enquiries`**: accepts `status` (`new`, `contacted`, `closed`). Each item:
`{ id, leadId, user, phone, name, property, propertyTitle, message, source, status, createdAt }`.

**PATCH `/api/crm/enquiries/:id`**: `{ "status": "new" | "contacted" | "closed" }`. Usually you
change the lead instead, and its enquiries follow.

**GET `/api/crm/views`**: raw property views from signed-in users. Accepts `search`, `propertyId`,
`userId` and `minViews`. Each item: `{ id, user, phone, name, email, city, purpose, property,
propertyTitle, propertyLocation, views, firstViewedAt, lastViewedAt }`.

---

## 5. Properties

| Method | Path | Who |
|--------|------|-----|
| GET | `/properties` | staff |
| POST | `/properties` | staff |
| GET | `/properties/:id` | staff |
| PATCH | `/properties/:id` | staff |
| DELETE | `/properties/:id` | 🔒 |
| POST | `/properties/bulk` | staff (`delete` 🔒) |
| GET | `/properties/:id/leads` | staff |
| DELETE | `/reviews/:id` | staff |
| POST | `/api/uploads` | any signed-in user |

Two kinds of listing exist:
- **App-posted** (`dataSource: "manual"`): staff can edit and delete these.
- **Imported**: everything else. These can only be moderated (approval and featured). They can't be edited or deleted.

### GET `/api/crm/properties`
Includes pending and rejected listings. Accepts **all public search filters** (`search, city,
locality, developer, project, deal, propertyType, propertyTypes, bhk, bathrooms, minPrice, maxPrice,
minArea, maxArea, areaUnit, furnishing, possession, postedBy, age, facing, amenities, verified,
withPhotos, rera, postedSince, featured, section`), plus:

| Query | Values |
|-------|--------|
| `approvalStatus` | `pending`, `approved`, `rejected` |
| `dataSource` | `manual`, or an importer's name |
| `ownerUserId` | Listings posted by one user |
| `sort` | `newest`, `price_asc`, `price_desc`, `relevance`. When omitted, sorts by creation date (newest first). |

**Staff property item:** the normalised public card, plus:
```json
{ "rejectionReason": "", "ownerUserId": "…", "ownerName": "…", "contactPhone": "…",
  "reviewedBy": { "id": "…", "name": "…" }, "reviewedAt": "…",
  "leadCount": 12, "viewCount": 230, "enquiryCount": 4 }
```
`viewCount` here is the number of distinct signed-in viewers.

### GET `/api/crm/properties/:id`
```json
{ "property": { …staff property item },
  "owner": { "id": "…", "name": "…", "phone": "…", "role": "broker" },
  "rating": { "average": 4.2, "count": 18 },
  "counts": { "views": 410, "uniqueViewers": 233, "enquiries": 12, "leads": 240, "saves": 57 },
  "editable": true }
```
`owner` and `rating` are `null` when the listing has none. `editable` is `true` only for app-posted listings.

### POST `/api/crm/properties`
Posts a listing on behalf of an owner. It uses **the same fields and validation as `POST /api/post-property`**:
`title, city, locality, propertyType, bhk, price, area, description, listingType, category, bathrooms,
parking, furnishing, facing, floor, totalFloors, possessionStatus, ageOfProperty, amenities, facilities,
buildingGrade, highlights, images, contactName, contactPhone`. Extra optional fields:
- `ownerUserId`: the listing shows up in that user's "My listings" in the app.
- `featured`: boolean.

Staff posts go live straight away (`approved`). → `201 { "property": item }`.
Validation errors return `400` with `errors` per field.

### PATCH `/api/crm/properties/:id`
| Field | Notes |
|-------|-------|
| `approvalStatus` | `approved`, `rejected` or `pending`. Records `reviewedBy` and `reviewedAt`. **`rejected` requires `rejectionReason`.** `approved` clears the rejection reason. |
| `rejectionReason` | Up to 300 characters |
| `featured` | Boolean |
| Any post-form field (see above) | **App-posted listings only.** Staff can also change location, type and BHK, which owners can't. The edit is re-validated and the search fields are rebuilt. Sending these fields for an imported listing returns `403`. |

When a listing is approved or rejected, its owner gets an in-app notification.
Returns `{ "property": item }`.

### DELETE `/api/crm/properties/:id` 🔒
Only works for app-posted listings (imported ones return `403`). It also deletes the listing's
reviews, rating and view records. Its open leads are marked `lost` with `lostReason: "listing_removed"`.

### POST `/api/crm/properties/bulk`
```json
{ "ids": ["…"], "action": "approve" | "reject" | "feature" | "unfeature" | "delete", "rejectionReason": "Duplicate" }
```
Up to 100 IDs. `reject` requires `rejectionReason`, and `delete` is 🔒. Returns `{ updated, failed: [{ id, message }] }`.

### GET `/api/crm/properties/:id/leads`
The same as `GET /leads?propertyId=:id`, with the same query and response.

### DELETE `/api/crm/reviews/:id`
Removes a review and recalculates the listing's rating. → `{ "deleted": true }`.

### POST `/api/uploads`
`multipart/form-data` with an `image` field: JPEG, PNG or WebP, up to 8 MB.
→ `201 { "url": "https://<host>/uploads/<uuid>.jpg" }`. Put the URL in `images[]` when creating or editing a listing.

---

## 6. Customers and staff

Accounts live in two collections: **phone** accounts (OTP login) and **email** accounts (password
login). The CRM shows them as one list with `accountType: "phone" | "email"`. Email accounts have no
`purpose` or `city`.

### 6.1 Customers

| Method | Path | Who |
|--------|------|-----|
| GET | `/users` | staff |
| GET | `/users/:id` | staff |
| PATCH | `/users/:id` | 🔒 |
| GET | `/users/:id/leads` | staff |
| GET | `/users/:id/properties` | staff |
| POST | `/users/:id/notify` | staff |

**GET `/users`**: accepts the query values below. Each item:
`{ id, name, fullName, phone, email, role, purpose, city, accountType, isActive, createdAt, lastLoginAt, leadCount, listingCount }`.

| Query | Values |
|-------|--------|
| `search` | Phone or name; for email accounts, also the email |
| `accountType` | `phone`, `email` |
| `role` | `user`, `broker`, `developer`, `admin`, `superadmin` |
| `isActive` | `true`, `false` |
| `purpose`, `city` | Phone accounts only. Setting either one leaves email accounts out. |
| `from`, `to` | Sign-up date range |
| `sort` | `-createdAt` (default), `-lastLoginAt` |

**GET `/users/:id`**
```json
{ "user": { …item },
  "counts": { "leads": 3, "enquiries": 2, "views": 14, "saved": 4, "listings": 1, "reviews": 0 },
  "recentLeads": [ …Lead (5) ],
  "recentViews": [ { "property": "…", "propertyTitle": "…", "propertyLocation": "…", "views": 3, "lastViewedAt": "…" } ] }
```

**PATCH `/users/:id`** 🔒: `{ "role"?: "…", "isActive"?: boolean }`. Works for both account types.
You can't change your own role or status, and you can't demote or deactivate the **last active super admin**.
A disabled user is rejected on their next request, and email accounts also can't sign in.

**GET `/users/:id/leads`**: the same as `GET /leads?userId=:id`.
**GET `/users/:id/properties`**: every listing the user posted, in any approval state. Same item shape as `/properties`.

**POST `/users/:id/notify`**: sends one in-app notification to the user.
```json
{ "type": "info" | "property" | "price", "title": "Price drop", "message": "…", "data": { "propertyId": "…" } }
```
→ `201 { "sent": true }`. `title` (up to 120 characters) and `message` (up to 1000) are required.

### 6.2 Staff

| Method | Path | Who |
|--------|------|-----|
| GET | `/staff` | staff (admins get a short list) |
| POST | `/staff` | 🔒 |
| PATCH | `/staff/:id` | 🔒 |
| POST | `/staff/:id/reset-password` | 🔒 |
| DELETE | `/staff/:id` | 🔒 |

**GET `/staff`**: accepts `role` and `isActive`.
- **Admins** get the active staff list in short form, `[{ id, name, role }]`, for "assign to" pickers.
- **Super admins** get every field: `{ id, name, email, phone, role, accountType, isActive, lastLoginAt, createdAt, openLeads }`.

**POST `/staff`**: creates an email staff account.
```json
{ "fullName": "Neha P", "email": "neha@avodahgroup.co", "phone": "9876500000", "role": "admin", "password": "<temporary, 8–128 chars>" }
```
→ `201 { "staff": … }`, or `409` if the email already exists. The new staff member signs in with `POST /api/auth/signin`.

**PATCH `/staff/:id`**: `{ fullName?, phone?, role?, isActive? }`.
- `phone` can only be changed on email accounts, because it is the login of a phone account.
- Setting `role` to `user` removes CRM access.
- The same rules apply as for users: you can't change your own role or status, and the last super admin stays.

**POST `/staff/:id/reset-password`**: `{ "password": "<temporary>" }`. Email accounts only.

**DELETE `/staff/:id`**: **deactivates** the account. Staff are never hard-deleted, so the audit trail
keeps pointing at them. Their open leads are moved to `{ "reassignTo": "<staffId>" }` if given,
otherwise they become unassigned. → `{ "deactivated": true, "leadsMoved": 7, "reassignedTo": "…" }`.
To reactivate someone, send `PATCH` with `{ "isActive": true }`.

---

## 7. Notifications, audit log and settings

### 7.1 Staff notifications
Staff receive notifications through the existing endpoints (`GET /api/notifications`,
`PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`). The server sends:

| `type` | Event | Recipients |
|--------|-------|------------|
| `lead` | New enquiry | The assignee, or every active super admin if the lead is unassigned |
| `lead` | Lead assigned (by hand or auto-assignment) | The new assignee |
| `lead` | Follow-up due (checked every 15 minutes, sent once per follow-up time) | The assignee |
| `approval` | An app listing is waiting for approval (new or edited) | Every active staff member |
| `property` | A listing was approved or rejected | The listing owner (a customer) |

`data` carries `{ leadId }` or `{ propertyId }` so the CRM can deep-link.

### 7.2 GET `/api/crm/audit-log` 🔒
Accepts `actor`, `entity`, `entityId`, `action`, `from` and `to`. `entity` is one of `lead`,
`lead_activity`, `property`, `user`, `staff`, `enquiry`, `review`, `settings`.
```json
{ "items": [ { "id": "…", "actor": { "id": "…", "name": "Neha", "role": "admin" },
               "action": "update", "entity": "lead", "entityId": "…",
               "changes": { "status": ["new", "contacted"] }, "ip": "…", "createdAt": "…" } ], … }
```
`action` is one of `create`, `update`, `assign`, `delete`, `export`, `notify`, `change_password`, `reset_password`.

### 7.3 Settings
**GET `/api/crm/settings`** (all staff) and **PATCH `/api/crm/settings`** 🔒. PATCH accepts a partial
object; values you leave out keep their current setting.
```json
{
  "autoApprovePosts": false,
  "leads": {
    "viewThreshold": 1,
    "autoAssign": "none",
    "scoreWeights": { "enquiry": 40, "view": 3, "saved": 10, "purpose": 10, "recent": 10 },
    "lostReasons": ["not_interested", "budget", "bought_elsewhere", "unreachable", "listing_removed"]
  },
  "followUps": { "defaultHours": 24 }
}
```
| Key | Meaning |
|-----|---------|
| `autoApprovePosts` | `true` makes app posts and owner edits go live without review. The default comes from `AUTO_APPROVE_POSTS` in `.env`. |
| `leads.viewThreshold` | How many views of a listing (1–100) before a customer becomes a lead |
| `leads.autoAssign` | `none`, or `least_loaded`: new leads go to the active staff member with the fewest open leads |
| `leads.scoreWeights` | Points for each score signal (0–100 each) |
| `leads.lostReasons` | Suggested reasons for the CRM's "lost" picker |
| `followUps.defaultHours` | Suggested default follow-up delay. The CRM uses it to pre-fill dates. |

---

## 8. Operations

- **First deploy:** run `npm run backfill:leads` in `backend/` once. It creates leads from existing
  enquiries and views, and is safe to run again. Enquiries already marked `contacted` start as
  `contacted`, and `closed` ones as `lost` with `lostReason: "closed_before_crm"`. Use `-- --dry-run`
  to only count. Backfilled leads have today's `createdAt`, so the trends chart shows a one-day spike on that date.
- **First super admin:** put the phone number in `SUPERADMIN_PHONES`, log in with OTP, then create
  email staff accounts from the CRM.
- Numbers listed in `ADMIN_PHONES` or `SUPERADMIN_PHONES` are **re-promoted on every OTP login**. To
  remove someone listed there, take them out of `.env` (or deactivate the account, which blocks login).
- **Not built yet:** outgoing webhooks (pushing events to a CRM server). For now, poll `/leads` or
  `/follow-ups` with `sort=-lastActivityAt`.
- Tests: `backend/test/crm.test.js` covers the role matrix, lead lifecycle, assignment rules,
  activities, follow-ups, export, listings, users, staff, settings and the audit log.

---

## 9. Quick reference

```
AUTH
POST   /api/auth/signin                      email + password → token
POST   /api/auth/send-otp | verify-otp       phone OTP → token
GET    /api/crm/me                           staff check + permissions
POST   /api/crm/me/password

DASHBOARD
GET    /api/crm/stats
GET    /api/crm/stats/trends
GET    /api/crm/stats/staff-performance      🔒

LEADS
GET    /api/crm/leads
POST   /api/crm/leads
GET    /api/crm/leads/export                 🔒
POST   /api/crm/leads/bulk
GET    /api/crm/leads/:id
PATCH  /api/crm/leads/:id
DELETE /api/crm/leads/:id                    🔒
POST   /api/crm/leads/:id/assign
GET    /api/crm/leads/:id/activities
POST   /api/crm/leads/:id/activities
PATCH  /api/crm/leads/:id/activities/:aid
DELETE /api/crm/leads/:id/activities/:aid
GET    /api/crm/follow-ups
GET    /api/crm/enquiries
PATCH  /api/crm/enquiries/:id
GET    /api/crm/views

PROPERTIES
GET    /api/crm/properties
POST   /api/crm/properties
POST   /api/crm/properties/bulk
GET    /api/crm/properties/:id
PATCH  /api/crm/properties/:id
DELETE /api/crm/properties/:id               🔒
GET    /api/crm/properties/:id/leads
DELETE /api/crm/reviews/:id
POST   /api/uploads

CUSTOMERS & STAFF
GET    /api/crm/users
GET    /api/crm/users/:id
PATCH  /api/crm/users/:id                    🔒
GET    /api/crm/users/:id/leads
GET    /api/crm/users/:id/properties
POST   /api/crm/users/:id/notify
GET    /api/crm/staff
POST   /api/crm/staff                        🔒
PATCH  /api/crm/staff/:id                    🔒
POST   /api/crm/staff/:id/reset-password     🔒
DELETE /api/crm/staff/:id                    🔒

SYSTEM
GET    /api/crm/audit-log                    🔒
GET    /api/crm/settings
PATCH  /api/crm/settings                     🔒
```
