# TheLyfex Admin Backend — Technical Documentation

This document describes **everything implemented to date**: the **`admin-backend`** service (standalone Express app), all **REST APIs**, **RBAC**, **MongoDB collections**, and **changes made to the main `Lyfex-backend`** so both apps share the same database and business rules where applicable.

---

## 1. High-level overview

| Item | Description |
|------|--------------|
| **Purpose** | Admin-only HTTP API for user moderation, discussion management, RBAC, audit logs, and analytics summaries. |
| **Project path** | `LYFEX/admin-backend/` |
| **Runtime** | Node.js 18+, Express 4, Mongoose 8 |
| **Database** | **Same MongoDB** as `Lyfex-backend` via `MONGODB_URI`. |
| **User app JWT** | **Not** used for admin routes. Admin uses a **separate** access token signed with `ADMIN_JWT_SECRET`. |
| **Shared models** | Main app `User`, `DiscussionRoom`, `MeetingMessage`, etc. are **required from `Lyfex-backend/src/models`** (see §6) so schemas are not duplicated. |
| **Port** | Default `4100` (`ADMIN_PORT`). |

---

## 2. Changes to main `Lyfex-backend` (not in `admin-backend`)

These files were **modified** so app users respect admin-driven account state.

### 2.1 `Lyfex-backend/src/models/User.js`

**Added fields:**

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `isBlocked` | Boolean | `false` | Block sign-in; optional message in `blockedReason`. |
| `isSuspended` | Boolean | `false` | Suspend sign-in. |
| `suspendedUntil` | Date | `null` | If set and in the future, suspension is active; if in the past, login may clear flags. |
| `blockedReason` | String | `""` | Shown on blocked login when non-empty. |
| `contributorVerifiedAt` | Date | `null` | Set when admin verifies contributor. |
| `contributorBadge` | Boolean | `false` | Admin-assigned badge flag (`PATCH /users/assign-badge/:id`). |
| `contributorBadgeAssignedAt` | Date | `null` | Timestamp when badge was assigned. |
| `country` | String | `""` | Optional country label (filtered via `GET /users?country=`). |
| `lastActive` | Date | `null` | Optional last-activity stamp (populate from main app later; filtered via `lastActiveBefore`). |
| `deletedAt` | Date | `null` | Soft-delete timestamp; user cannot sign in. |

**Added indexes:** `deletedAt`, `isBlocked`, compound `isSuspended + suspendedUntil`, `country`, `lastActive`.

### 2.2 `Lyfex-backend/src/models/DiscussionRoom.js`

**Added fields:**

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `isPinned` | Boolean | `false` | Admin “pin” for listings. |
| `isFeatured` | Boolean | `false` | Admin “feature” for listings. |

**Added indexes:** `isPinned`, `isFeatured`, and compound sort indexes on `createdAt`.

### 2.3 `Lyfex-backend/src/routes/auth.js`

**Login (`POST /api/auth/login`):**

- Rejects if `deletedAt` is set.
- Rejects if `isBlocked` (uses `blockedReason` in message when present).
- Rejects if suspended indefinitely (`isSuspended` and no `suspendedUntil`) or if `suspendedUntil` is still in the future.
- After successful password check, if suspension was **date-based and already expired**, clears `isSuspended` / `suspendedUntil`.

**Google auth (`POST /api/auth/google`):**

- Same checks for existing users before issuing token.
- Clears expired dated suspension after user is loaded, before JWT is issued.

**Register** is unchanged (new users are not blocked by these fields by default).

---

## 3. New `admin-backend` — folder structure

```
admin-backend/
├── server.js                 # Entry: Express, Mongo, routes, bootstrap
├── package.json
├── .env.example
├── DOCUMENTATION.md          # This file
├── README.md
└── src/
    ├── config/
    │   └── jwt.js            # Access JWT sign/verify (ADMIN_JWT_SECRET)
    ├── controllers/          # Thin HTTP handlers
    ├── middleware/
    │   ├── attachAdmin.js
    │   ├── errorHandler.js
    │   ├── requirePermission.js
    │   ├── requireRole.js
    │   ├── checkPermission.js   # Alias of requirePermission
    │   └── checkRole.js         # Alias of requireRole
    ├── models/               # Admin-only Mongoose models (see §5)
    ├── routes/
    │   ├── admin.routes.js
    │   ├── roles.routes.js
    │   ├── users.routes.js
    │   ├── discuss.routes.js
    │   └── analytics.routes.js
    ├── services/             # Business logic
    ├── utils/
    ├── validators/
    ├── logs/                 # Placeholder (.gitkeep)
    └── sockets/              # Placeholder (.gitkeep)
```

---

## 4. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** | Same connection string as main backend. |
| `ADMIN_JWT_SECRET` | **Yes** (for login) | Secret for **admin access** JWT (must differ from main `JWT_SECRET`). |
| `ADMIN_PORT` | No | Default `4100`. |
| `ADMIN_CORS_ORIGINS` | No | Comma-separated origins; `*` allows all. Empty allows permissive CORS in dev. |
| `LYFEX_MAIN_BACKEND_ROOT` | No | Absolute path to `Lyfex-backend` if not sibling of `admin-backend`. |
| `ADMIN_BOOTSTRAP_EMAIL` | No | If DB has **zero** admins, creates first super admin (with password). |
| `ADMIN_BOOTSTRAP_PASSWORD` | No | Password for bootstrap admin. |
| `ADMIN_BOOTSTRAP_KEY` | No | If set, must match this value or bootstrap is skipped. |
| `ADMIN_BOOTSTRAP_NAME` | No | Display name for bootstrap admin. |

Copy from `.env.example` and create `.env`.

---

## 5. MongoDB collections — admin service

These are **new** collections created by admin models (Mongoose default pluralization applies, e.g. `Admin` → typically `admins`).

| Model | Collection (typical) | Role |
|-------|----------------------|------|
| `Admin` | `admins` | Admin user accounts (separate from `User`). |
| `Role` | `roles` | RBAC roles (system + custom). |
| `Permission` | `permissions` | Catalog of permission keys. |
| `AdminActivityLog` | `adminactivitylogs` | Audit trail. |
| `AdminRefreshToken` | `adminrefreshtokens` | Hashed refresh tokens (+ expiry, revoke). |
| `DiscussionReport` | `discussionreports` | Report queue; includes optional `reportedUserId` for stats (“reports received”). |

**Shared with main backend (read/write via required models):** `users`, `discussionrooms`, `meetingmessages`, `userschedulepins`, plus any analytics aggregates over `useranalytics`, `saveddiscussionrecordings`, etc.

---

## 6. Sharing main-backend models (`LYFEX_MAIN_BACKEND_ROOT`)

File: `src/utils/mainBackendPath.js`

1. If `LYFEX_MAIN_BACKEND_ROOT` is set and contains `src/models`, that path is used.
2. Otherwise: resolve `../../../Lyfex-backend` from `src/utils` (expects `Lyfex-backend` beside `admin-backend` under the same parent folder).

`mainModel("User")` loads `Lyfex-backend/src/models/User.js` (same for `DiscussionRoom`, `MeetingMessage`, …).

---

## 7. Authentication & tokens

### 7.1 Access token

- **Header:** `Authorization: Bearer <access_token>`
- **Payload:** `{ sub: <adminId>, typ: "admin_access" }`
- **Lifetime:** 1 hour (see `src/config/jwt.js`)
- **Verification:** Middleware `attachAdmin` → `verifyAccessFromHeader` loads `Admin` + `Role`, attaches `req.admin`, `req.adminId`, `req.roleSlug`, `req.permissionKeys`.

### 7.2 Refresh token

- **Opaque** random string returned at login / refresh (not the same JWT as the main app).
- Stored as **SHA-256 hash** in `AdminRefreshToken` with `expiresAt` (7 days).
- Rotate on `POST /admin/refresh-token`: old token revoked, new pair issued.

### 7.3 Super-admin bypass

Permission middleware: `super_admin` role slug bypasses all `requirePermission` checks.

---

## 8. Permission catalog (canonical keys)

| Key | Group | Description |
|-----|-------|--------------|
| `admins.manage` | admins | Create/update/delete admins |
| `admins.read` | admins | List and view admins |
| `roles.manage` | rbac | CRUD roles & assign permissions |
| `roles.read` | rbac | View roles & permission catalog |
| `users.read` | users | List/search users |
| `users.write` | users | Edit user profiles (reserved; no dedicated endpoint in Day‑1 beyond support role) |
| `users.block` | users | Block users |
| `users.suspend` | users | Suspend users |
| `users.delete` | users | Soft-delete users |
| `users.verify_contributor` | users | Verify contributor |
| `analytics.users` | analytics | User analytics API |
| `analytics.discussions` | analytics | Discussion analytics API |
| `discussions.read` | discussions | View discussion rooms |
| `discussions.moderate` | discussions | Reports / moderation endpoints |
| `discussions.delete` | discussions | Delete discussion rooms |
| `discussions.pin` | discussions | Pin / feature rooms |
| `activity.read` | audit | View admin activity logs |

---

## 9. Built-in roles (seeded on startup)

| Slug | Notes |
|------|--------|
| `super_admin` | All permission keys |
| `admin` | All keys **except** `roles.manage` and `admins.manage` |
| `moderator` | Discussions + read users + activity |
| `analytics_manager` | Analytics + read users/discussions + activity |
| `support_manager` | Users (read/write/block/suspend) + activity |
| `content_manager` | Discussions read/pin/moderate + activity + read users |

On each boot, **system role permission lists** are **re-synced** from code (bootstrap). Custom roles (`isSystem: false`) keep their own keys; **`permissionKeys` on system roles cannot be changed via API** (updates to other fields allowed per `rbacService` rules).

---

## 10. HTTP API reference

**Base URL example:** `http://localhost:4100`

Unless noted, JSON body / query. Pagination where supported: **`page`** (default 1), **`limit`** (default 20, max 100).

### 10.1 Public / semi-public

| Method | Path | Auth | Permission | Description |
|--------|------|------|-------------|--------------|
| `GET` | `/` | None | — | Health: `{ ok, service }` |
| `POST` | `/admin/login` | None | — | Body: `{ "email", "password" }`. Returns `accessToken`, `expiresInSeconds`, `refreshToken`, `refreshExpiresAt`, `admin` summary. |
| `POST` | `/admin/refresh-token` | None | — | Body: `{ "refreshToken" }`. Returns new access + refresh. |

### 10.2 Admin routes (`/admin`)

All routes below **`/admin`** except `login` and `refresh-token` require **`Authorization: Bearer <access_token>`**.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/admin/logout` | Any authenticated admin | Body (optional): `{ "refreshToken" }` — revokes that refresh token; always logs logout if `adminId` available. |
| `GET` | `/admin/me` | Any authenticated admin | Current admin + role summary. |
| `PATCH` | `/admin/profile` | Any authenticated admin | Body: `{ "fullName?" , "currentPassword?", "newPassword?" }`. Password change requires current password. |
| `GET` | `/admin/activity-logs` | `activity.read` | Query: `page`, `limit`, optional `adminId`, `action`, `targetType`. |
| `POST` | `/admin/create` | `admins.manage` | Body: `{ "email", "password", "fullName", "roleId" }`. |
| `GET` | `/admin/all` | `admins.read` | Query: `page`, `limit`, `q` (email/name substring). |
| `PATCH` | `/admin/update/:id` | `admins.manage` | Body: `{ "fullName?", "roleId?" }`. |
| `DELETE` | `/admin/delete/:id` | `admins.manage` | Hard delete admin document (cannot delete self here). |
| `PATCH` | `/admin/suspend/:id` | `admins.manage` | Body: `{ "suspend": boolean, "reason?" }`. Suspension revokes all refresh tokens for that admin. |

### 10.3 Roles (`/roles`)

Requires **`Authorization: Bearer`**.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/roles` | `roles.read` | List all roles. |
| `GET` | `/roles/permissions/catalog` | `roles.read` | List all permission documents. |
| `POST` | `/roles/create` | `roles.manage` | Body: `{ "name", "slug", "permissionKeys": [], "description?" }`. Slug regex: `^[a-z][a-z0-9_]{1,48}$`. |
| `PATCH` | `/roles/:id` | `roles.manage` | Body: `{ "name?", "permissionKeys?", "isActive?", "description?" }`. **Cannot** change `permissionKeys` for **system** roles. |
| `DELETE` | `/roles/:id` | `roles.manage` | Cannot delete system roles or roles assigned to admins. |

### 10.4 App users (`/users`)

Requires **`Authorization: Bearer`**.

**`GET /users` query filters**

| Parameter | Values / format | Behaviour |
|-----------|-----------------|------------|
| `page`, `limit` | Integers | Pagination (default page 1, limit 20, max 100). |
| `q` | String | Case-insensitive substring on `email` or `fullName`. |
| `plan` | `VIEW` \| `TALK` \| `CONTRIBUTE` | Exact plan filter. |
| `status` | `active` \| `blocked` \| `suspended` \| `deleted` | **Default (omit):** only non-deleted users. **`active`:** `isBlocked=false`, `isSuspended=false`, not deleted. **`blocked`:** `isBlocked=true`. **`suspended`:** `isSuspended=true`. **`deleted`:** only soft-deleted (`deletedAt` set). |
| `country` | String | Exact match case-insensitive on `User.country`. |
| `joinedAfter`, `joinedBefore` | ISO 8601 strings | Filters on `createdAt` (`>=` / `<=`). Invalid dates → `400`. |
| `lastActiveBefore` | ISO 8601 string | **`lastActive <=` date** — only affects users that have `lastActive` set (documents without field are omitted by this predicate). |

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/users` | `users.read` | Paginated user list with filters above. |
| `GET` | `/users/:id` | `users.read` | User document (**including** soft-deleted) without password/OTP. Includes **`stats`** object — see below. |
| `PATCH` | `/users/block/:id` | `users.block` | Body: `{ "block": boolean, "reason?" }`. |
| `PATCH` | `/users/suspend/:id` | `users.suspend` | Body: `{ "suspend": boolean, "until?" }` (ISO date optional; missing `until` + `suspend: true` = indefinite-style per main auth rules). |
| `PATCH` | `/users/assign-badge/:id` | `users.verify_contributor` | Sets **`contributorBadge: true`** and **`contributorBadgeAssignedAt`**: `now`. Logs **`ASSIGN_BADGE`** to **`AdminActivityLog`**. Response includes user + **`stats`**. |
| `PATCH` | `/users/reset/:id` | `users.write` | Sets **`isBlocked: false`**, **`isSuspended: false`**, **`suspendedUntil: null`**, **`blockedReason: ""`**. Logs **`RESET_ACCOUNT`**. Applies to existing users (**including deleted** profiles if you reset flags). Response includes **`stats`**. |
| `DELETE` | `/users/:id` | `users.delete` | Soft delete: sets `deletedAt`, `isBlocked: true`. |
| `PATCH` | `/users/verify-contributor/:id` | `users.verify_contributor` | Sets `subscriptionPlan: "CONTRIBUTE"` and `contributorVerifiedAt: now`. |

**`GET /users/:id` (and badge/reset PATCH) — `stats` object**

Computed on the shared DB:

| Key | Meaning |
|-----|---------|
| `totalSessionsJoined` | Count of **`DiscussionRoom`** documents whose **`participants`** array contains this user’s `_id`. |
| `totalRoomsCreated` | Count of **`DiscussionRoom`** documents with **`hostId`** = user `_id`. |
| `totalWatchTime` | **Minutes**, sum of **`duration`** on **`WatchSession`** and **`LiveSession`** (`sessionType` in `learn` \| `watch`) where **`participants`** contains the user *(scheduled duration proxy — not streamed watch-second telemetry).* |
| `reportsReceived` | Count of **`DiscussionReport`** docs with **`reportedUserId`** = user `_id`. |

**Note:** Express route order: static paths (`block`, `suspend`, `assign-badge`, `reset`, `verify-contributor`) are registered **before** `DELETE /:id` and **`GET /:id`**.

### 10.5 Discussions (`/discuss`)

Requires **`Authorization: Bearer`**.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/discuss/rooms` | `discussions.read` | Query: `page`, `limit`, `q`, `isLive` (`true`/`false`). Sort: pinned/featured first. |
| `GET` | `/discuss/room/:id` | `discussions.read` | `:id` = Mongo `_id` **or** `roomId` string. |
| `DELETE` | `/discuss/room/:id` | `discussions.delete` | Deletes room, related `UserSchedulePin` (discussion), `MeetingMessage` for that room; best-effort LiveKit cleanup via main `livekitClient` if resolvable. |
| `PATCH` | `/discuss/pin/:id` | `discussions.pin` | Body: `{ "pinned": boolean }`. |
| `PATCH` | `/discuss/feature/:id` | `discussions.pin` | Body: `{ "featured": boolean }`. |
| `GET` | `/discuss/reports` | `discussions.moderate` | Paginated `DiscussionReport` list. |
| `PATCH` | `/discuss/reports/:reportId` | `discussions.moderate` | Body: `{ "status?", "adminNote?" }`. Status enum: `pending`, `reviewing`, `dismissed`, `action_taken`. |

### 10.6 Analytics (`/analytics`)

Requires **`Authorization: Bearer`**.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/analytics/users` | `analytics.users` | Aggregated user metrics (DAU/MAU-style and online heuristic — see service comments in `analyticsUserService.js`). |
| `GET` | `/analytics/discussions` | `analytics.discussions` | Aggregated discussion metrics (see `analyticsDiscussionService.js`). |

---

## 11. Error handling

- **`AppError`** (`src/utils/AppError.js`): `{ statusCode, message, details? }`
- Global **`errorHandler`** maps `AppError`, JWT errors, and `500` for unknown errors.
- Route handlers wrapped with **`asyncHandler`** to forward `next(err)`.

---

## 12. Dependencies (`package.json`)

| Package | Role |
|---------|------|
| `express` | HTTP server |
| `mongoose` | MongoDB ODM |
| `jsonwebtoken` | Admin access JWT |
| `bcrypt` | Admin password hashing |
| `cors` | CORS |
| `dotenv` | Environment |
| `morgan` | Request logging |
| `nodemon` | Dev reload (devDependency) |

---

## 13. Scripts

| Command | Description |
|---------|-------------|
| `npm start` | `node server.js` |
| `npm run dev` | `nodemon server.js` |

---

## 14. Indexing & operations notes

- **User** (main backend): indexes on `deletedAt`, `isBlocked`, `isSuspended` + `suspendedUntil`.
- **DiscussionRoom**: indexes on `isPinned`, `isFeatured`, compounds for admin listings.
- **AdminActivityLog**: compound indexes on `(adminId, createdAt)`, `(action, createdAt)`, etc. Consider **TTL** in production when retention policy is fixed.
- **AdminRefreshToken**: unique `tokenHash`; consider periodic job to delete expired rows.

---

## 15. Relationship to main backend (summary)

| Concern | Main `Lyfex-backend` | `admin-backend` |
|---------|---------------------|----------------|
| End-user JWT | `JWT_SECRET`, `/api/auth/*` | Unused for admin APIs |
| User identity | `User` collection | Separate `Admin` collection |
| Moderation flags | Stored on `User` | Writes same `User` documents |
| Discussion flags | `isPinned`, `isFeatured` on `DiscussionRoom` | Writes same documents |
| Realtime / sockets | Socket.IO on main server | No Socket.IO in admin service (placeholder folder only) |

---

## 16. Filename / project rename note

The admin API was consolidated into the existing **`admin-backend`** repository folder. The npm package **`name`** field is **`admin-backend`**. The deleted duplicate folder was **`Lyfex-admin-backend`**.

---

*Last updated to match codebase layout under `LYFEX/admin-backend` and `LYFEX/Lyfex-backend`.*
