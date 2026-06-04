# TheLyfex Admin Backend — Technical Documentation

This document describes **everything implemented to date**: the **`admin-backend`** service (standalone Express app), all **REST APIs**, **RBAC**, **MongoDB collections**, and the architecture decisions made during refactoring.

---

## 1. High-level overview

| Item | Description |
|------|-------------|
| **Purpose** | Admin-only HTTP API for user moderation, session management, discussion moderation, referrals, payments, RBAC, audit logs, and analytics. |
| **Project path** | `LYFEX/admin-backend/` |
| **Runtime** | Node.js 18+, Express 4, Mongoose 8 |
| **Database** | **Same MongoDB** as `Lyfex-backend` via `MONGODB_URI`. |
| **Architecture** | Admin backend is fully independent. No imports from main backend. All models are defined locally. |
| **User app JWT** | **Not** used for admin routes. Admin uses a **separate** access token signed with `ADMIN_JWT_SECRET`. |
| **Port** | Default `4100` (`ADMIN_PORT`). |

---

## 2. Architecture — Independent Service
Both services are completely independent. They share the same MongoDB database but have **no shared code**. Admin backend defines its own local Mongoose models for every collection it accesses.

### 2.1 Local Models (admin-backend/src/models/)

| Model File | Collection | Purpose |
|---|---|---|
| `Admin.js` | `admins` | Admin user accounts |
| `AdminActivityLog.js` | `adminactivitylogs` | Audit trail |
| `AdminRefreshToken.js` | `adminrefreshtokens` | Hashed refresh tokens |
| `DiscussionReport.js` | `discussionreports` | Report queue |
| `DiscussionRoom.js` | `discussionrooms` | Discussion rooms (shared collection) |
| `LiveSession.js` | `livesessions` | Live/Learn sessions (shared collection) |
| `MeetingMessage.js` | `meetingmessages` | Chat messages (shared collection) |
| `PauseContent.js` | `pausecontents` | Pause sessions (shared collection) |
| `Payment.js` | `payments` | Payment/transaction records |
| `Permission.js` | `permissions` | RBAC permission catalog |
| `ReferralWithdrawal.js` | `referralwithdrawals` | Referral withdrawal records |
| `Role.js` | `roles` | RBAC roles |
| `SavedDiscussionRecording.js` | `saveddiscussionrecordings` | Saved recordings |
| `User.js` | `users` | App users (shared collection) |
| `UserAnalytics.js` | `useranalytics` | User analytics (shared collection) |
| `UserSchedulePin.js` | `userschedulepins` | Schedule pins (shared collection) |
| `WatchSession.js` | `watchsessions` | Watch sessions (shared collection) |

---

## 3. Folder structure
admin-backend/
├── server.js
├── package.json
├── .env.example
├── DOCUMENTATION.md
├── README.md
└── src/
├── config/
│   └── jwt.js
├── controllers/
│   ├── activityController.js
│   ├── adminAuthController.js
│   ├── adminCrudController.js
│   ├── analyticsController.js
│   ├── discussAdminController.js
│   ├── paymentController.js
│   ├── referralController.js
│   ├── roleController.js
│   ├── sessionController.js
│   └── userMgmtController.js
├── middleware/
│   ├── attachAdmin.js
│   ├── checkPermission.js
│   ├── checkRole.js
│   ├── errorHandler.js
│   ├── requirePermission.js
│   └── requireRole.js
├── models/
│   └── (see §2.1)
├── routes/
│   ├── admin.routes.js
│   ├── analytics.routes.js
│   ├── discuss.routes.js
│   ├── payment.routes.js
│   ├── referral.routes.js
│   ├── roles.routes.js
│   ├── session.routes.js
│   └── users.routes.js
├── services/
│   ├── activityLogQueryService.js
│   ├── activityLogService.js
│   ├── adminAuthService.js
│   ├── adminCrudService.js
│   ├── analyticsDiscussionService.js
│   ├── analyticsDashboardService.js
│   ├── analyticsSessionService.js
│   ├── analyticsUserService.js
│   ├── bootstrapService.js
│   ├── discussionAdminService.js
│   ├── paymentService.js
│   ├── rbacService.js
│   ├── referralService.js
│   ├── sessionService.js
│   └── userManagementService.js
├── utils/
│   ├── AppError.js
│   ├── asyncHandler.js
│   ├── pagination.js
│   └── requestHelpers.js
└── validators/
      └── common.js


---

## 4. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** | Same connection string as main backend. |
| `ADMIN_JWT_SECRET` | **Yes** | Secret for admin access JWT (must differ from main `JWT_SECRET`). |
| `ADMIN_PORT` | No | Default `4100`. |
| `ADMIN_CORS_ORIGINS` | No | Comma-separated origins; `*` allows all. |
| `ADMIN_BOOTSTRAP_EMAIL` | No | Creates first super admin if DB has zero admins. |
| `ADMIN_BOOTSTRAP_PASSWORD` | No | Password for bootstrap admin. |
| `ADMIN_BOOTSTRAP_KEY` | No | If set, must match or bootstrap is skipped. |
| `ADMIN_BOOTSTRAP_NAME` | No | Display name for bootstrap admin. |

---

## 5. Authentication & tokens

### 5.1 Access token
- **Header:** `Authorization: Bearer <access_token>`
- **Payload:** `{ sub: <adminId>, typ: "admin_access" }`
- **Lifetime:** 1 hour
- **Verification:** `attachAdmin` middleware loads Admin + Role, attaches `req.admin`, `req.adminId`, `req.roleSlug`, `req.permissionKeys`.

### 5.2 Refresh token
- Opaque random string stored as SHA-256 hash in `AdminRefreshToken` with `expiresAt` (7 days).
- Rotated on `POST /admin/refresh-token`.

### 5.3 Super-admin bypass
`super_admin` role slug bypasses all `requirePermission` checks.

---

## 6. Permission catalog

| Key | Group | Description |
|-----|-------|-------------|
| `admins.manage` | admins | Create/update/delete admins |
| `admins.read` | admins | List and view admins |
| `roles.manage` | rbac | CRUD roles & assign permissions |
| `roles.read` | rbac | View roles & permission catalog |
| `users.read` | users | List/search users |
| `users.block` | users | Block users |
| `users.suspend` | users | Suspend users |
| `users.delete` | users | Soft-delete users |
| `users.verify_contributor` | users | Verify contributor |
| `analytics.read` | analytics | All analytics endpoints |
| `discussions.read` | discussions | View discussion rooms |
| `discussions.moderate` | discussions | Reports/moderation |
| `discussions.delete` | discussions | Delete discussion rooms |
| `discussions.pin` | discussions | Pin/feature rooms |
| `sessions.read` | sessions | View all session types |
| `sessions.manage` | sessions | Update sessions, ban/unban users |
| `sessions.delete` | sessions | Delete sessions |
| `referrals.read` | referrals | View referral withdrawals |
| `referrals.manage` | referrals | Update withdrawal status |
| `payments.read` | payments | View payment records |
| `payments.manage` | payments | Update payment status |
| `activity.read` | audit | View admin activity logs |

---

## 7. Built-in roles

| Slug | Notes |
|------|-------|
| `super_admin` | All permission keys |
| `admin` | All keys except `roles.manage` and `admins.manage` |
| `moderator` | Discussions + read users + activity |
| `analytics_manager` | Analytics + read users/discussions + activity |
| `support_manager` | Users (read/block/suspend) + activity |
| `content_manager` | Discussions read/pin/moderate + activity + read users |

---

## 8. HTTP API reference

**Base URL:** `http://localhost:4100`

Pagination: `page` (default 1), `limit` (default 20, max 100).

### 8.1 Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check: `{ ok, service }` |
| `POST` | `/admin/login` | Body: `{ email, password }`. Returns `accessToken`, `refreshToken`, `admin`. |
| `POST` | `/admin/refresh-token` | Body: `{ refreshToken }`. Returns new token pair. |

### 8.2 Admin Management (`/admin`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/admin/logout` | Authenticated | Revokes refresh token. |
| `GET` | `/admin/me` | Authenticated | Current admin + role. |
| `PATCH` | `/admin/profile` | Authenticated | Update name or password. |
| `GET` | `/admin/activity-logs` | `activity.read` | Audit logs with filters. |
| `POST` | `/admin/create` | `admins.manage` | Create new admin. |
| `GET` | `/admin/all` | `admins.read` | List all admins. |
| `PATCH` | `/admin/update/:id` | `admins.manage` | Update admin. |
| `DELETE` | `/admin/delete/:id` | `admins.manage` | Delete admin. |
| `PATCH` | `/admin/suspend/:id` | `admins.manage` | Suspend/unsuspend admin. |

### 8.3 Roles & Permissions (`/roles`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/roles` | `roles.read` | List all roles. |
| `GET` | `/roles/permissions/catalog` | `roles.read` | All permissions. |
| `POST` | `/roles/create` | `roles.manage` | Create role. |
| `PATCH` | `/roles/:id` | `roles.manage` | Update role. |
| `DELETE` | `/roles/:id` | `roles.manage` | Delete role. |

### 8.4 User Management (`/users`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/users` | `users.read` | List users. Filters: `q`, `plan`, `status`, `country`, `joinedAfter`, `joinedBefore`. |
| `GET` | `/users/:id` | `users.read` | User details + stats. |
| `PATCH` | `/users/block/:id` | `users.block` | Block/unblock user. |
| `PATCH` | `/users/suspend/:id` | `users.suspend` | Suspend/unsuspend user. |
| `PATCH` | `/users/assign-badge/:id` | `users.verify_contributor` | Assign contributor badge. |
| `PATCH` | `/users/reset/:id` | `users.write` | Reset account flags. |
| `PATCH` | `/users/verify-contributor/:id` | `users.verify_contributor` | Verify contributor. |
| `DELETE` | `/users/:id` | `users.delete` | Soft delete user. |

### 8.5 Discussion Moderation (`/discuss`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/discuss/rooms` | `discussions.read` | List rooms. Filters: `q`, `isLive`. |
| `GET` | `/discuss/room/:id` | `discussions.read` | Room details. |
| `DELETE` | `/discuss/room/:id` | `discussions.delete` | Delete room + related data. |
| `PATCH` | `/discuss/pin/:id` | `discussions.pin` | Pin/unpin room. |
| `PATCH` | `/discuss/feature/:id` | `discussions.pin` | Feature/unfeature room. |
| `GET` | `/discuss/reports` | `discussions.moderate` | Report queue. |
| `PATCH` | `/discuss/reports/:reportId` | `discussions.moderate` | Resolve report. |

### 8.6 Session Management (`/sessions`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/sessions/watch` | `sessions.read` | List watch sessions. Filters: `q`, `status`, `category`, `isLive`, `isAutomated`. |
| `GET` | `/sessions/watch/stats` | `sessions.read` | Watch session stats. |
| `GET` | `/sessions/watch/:id` | `sessions.read` | Single watch session. |
| `PATCH` | `/sessions/watch/:id` | `sessions.manage` | Update watch session. |
| `DELETE` | `/sessions/watch/:id` | `sessions.delete` | Delete watch session. |
| `POST` | `/sessions/watch/:id/ban/:userId` | `sessions.manage` | Ban user from watch session. |
| `DELETE` | `/sessions/watch/:id/ban/:userId` | `sessions.manage` | Unban user from watch session. |
| `GET` | `/sessions/live` | `sessions.read` | List live sessions. Filters: `q`, `sessionType`, `status`, `isLive`. |
| `GET` | `/sessions/live/stats` | `sessions.read` | Live session stats. |
| `GET` | `/sessions/live/:id` | `sessions.read` | Single live session. |
| `PATCH` | `/sessions/live/:id` | `sessions.manage` | Update live session. |
| `DELETE` | `/sessions/live/:id` | `sessions.delete` | Delete live session. |
| `POST` | `/sessions/live/:id/ban/:userId` | `sessions.manage` | Ban user from live session. |
| `DELETE` | `/sessions/live/:id/ban/:userId` | `sessions.manage` | Unban user from live session. |
| `GET` | `/sessions/pause` | `sessions.read` | List pause sessions. Filters: `q`, `vibeTag`, `isLive`, `isInstantHangout`. |
| `GET` | `/sessions/pause/stats` | `sessions.read` | Pause session stats. |
| `GET` | `/sessions/pause/:id` | `sessions.read` | Single pause session. |
| `PATCH` | `/sessions/pause/:id` | `sessions.manage` | Update pause session. |
| `DELETE` | `/sessions/pause/:id` | `sessions.delete` | Delete pause session. |

### 8.7 Referral Management (`/referrals`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/referrals` | `referrals.read` | List withdrawals. Filters: `status`, `reason`, `from`, `to`. |
| `GET` | `/referrals/stats` | `referrals.read` | Withdrawal stats + amounts. |
| `GET` | `/referrals/user/:userId` | `referrals.read` | User referral summary. |
| `GET` | `/referrals/:id` | `referrals.read` | Single withdrawal. |
| `PATCH` | `/referrals/:id/status` | `referrals.manage` | Update withdrawal status. |

### 8.8 Payment & Transactions (`/payments`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/payments` | `payments.read` | List payments. Filters: `status`, `type`, `plan`, `from`, `to`. |
| `GET` | `/payments/stats` | `payments.read` | Revenue summary by type and plan. |
| `GET` | `/payments/user/:userId` | `payments.read` | User payment history. |
| `GET` | `/payments/:id` | `payments.read` | Single payment. |
| `PATCH` | `/payments/:id/status` | `payments.manage` | Update payment status. |

### 8.9 Analytics (`/analytics`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/analytics/dashboard` | `analytics.read` | Full dashboard summary — users, sessions, referrals, payments, recent activity. |
| `GET` | `/analytics/users` | `analytics.read` | User analytics — DAU, MAU, online users, retention. |
| `GET` | `/analytics/discussions` | `analytics.read` | Discussion analytics — rooms, messages, engagement. |
| `GET` | `/analytics/sessions/watch` | `analytics.read` | Watch session analytics — by category, source, trend. |
| `GET` | `/analytics/sessions/live` | `analytics.read` | Live session analytics — by type, visibility, trend. |
| `GET` | `/analytics/sessions/pause` | `analytics.read` | Pause session analytics — by vibe tag, views, trend. |

---

## 9. Payment Model — `payments` collection

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | Reference to User |
| `type` | String | `subscription` or `session_access` |
| `razorpayOrderId` | String | Razorpay order ID |
| `razorpayPaymentId` | String | Razorpay payment ID |
| `razorpaySignature` | String | Razorpay signature |
| `amount` | Number | Amount in rupees |
| `currency` | String | Default `INR` |
| `status` | String | `created`, `paid`, `failed`, `refunded` |
| `plan` | String | `VIEW`, `CONTRIBUTE` (for subscription type) |
| `subscriptionExpiresAt` | Date | Subscription expiry |
| `sessionId` | ObjectId | Reference to session (for session_access type) |
| `sessionType` | String | `watch`, `live`, `discuss` |
| `tier` | String | `vip`, `normal` |
| `note` | String | Admin note |

---

## 10. Error handling

- **`AppError`**: `{ statusCode, message }`
- Global **`errorHandler`** maps AppError, JWT errors, and 500.
- All route handlers wrapped with **`asyncHandler`**.
- Invalid ObjectId → `400 Bad Request`
- Resource not found → `404 Not Found`
- Unauthenticated → `401 Unauthorized`
- Insufficient permission → `403 Forbidden`

---

## 11. Pagination

All list endpoints support:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | 1 | — | Page number |
| `limit` | 20 | 100 | Items per page |

Response includes `meta`: `{ total, page, limit, totalPages }`

---

## 12. Dependencies

| Package | Role |
|---------|------|
| `express` | HTTP server |
| `mongoose` | MongoDB ODM |
| `jsonwebtoken` | Admin JWT |
| `bcrypt` | Password hashing |
| `cors` | CORS |
| `dotenv` | Environment |
| `morgan` | Request logging |
| `nodemon` | Dev reload |

---

## 13. Scripts

| Command | Description |
|---------|-------------|
| `npm start` | `node server.js` |
| `npm run dev` | `nodemon server.js` |

---

*Last updated: June 2026 — Admin backend v1 complete.*