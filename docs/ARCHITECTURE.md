# CampusConnect — Architecture & Design (Phase 1)

## 1. High-level architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│ React 18 SPA (Vite) · Tailwind · React Router · Context API      │
│  ├─ AuthContext   (current user, login/logout)                   │
│  ├─ ThemeContext  (light / dark, persisted)                      │
│  └─ SocketContext (socket.io-client, live notifications + chat)  │
│        │ Axios (REST, JSON, httpOnly cookie)   │ WebSocket        │
└────────┼───────────────────────────────────────┼─────────────────┘
         ▼                                       ▼
┌──────────────────── Node.js / Express 4 (MVC) ──────────────────┐
│ helmet · cors · rate-limit · mongo-sanitize · compression        │
│ routes/  →  middleware (protect, authorize, validate, upload)    │
│          →  controllers/  →  services/ (email, notifications,    │
│                                activity, priority, reminders)    │
│ socket.io server (JWT-authenticated, rooms: user:<id>, group:<id>)│
│ node-cron reminder job (task reminders, deadlines, event alerts) │
└────────┬─────────────────────────────────────────────────────────┘
         ▼ Mongoose 8
┌──────────── MongoDB (Atlas / local / in-memory for dev) ────────┐
│ users · tasks · studygroups · messages · resources · events ·    │
│ eventregistrations · announcements · notifications · activities  │
└──────────────────────────────────────────────────────────────────┘
         ▲
   uploads/ (disk) – resource files (served only through an
   authenticated download endpoint) and avatars (public images)
```

**Request lifecycle:** `Request → security middleware → router → protect (JWT from httpOnly cookie or Bearer header) → authorize(role) → validators → controller → service(s) → Mongoose model → JSON { success, data }`. Every error is thrown as an `ApiError` (or bubbles up from Mongoose/JWT/Multer). One central `errorHandler` turns it into `{ success: false, message, errors? }`.

**Real-time:** after login, the client opens a Socket.io connection. The server authenticates the handshake with the same JWT cookie and joins the socket to `user:<userId>`. Group pages emit `group:join`, and the server checks membership before joining `group:<groupId>`. `notificationService.notify()` saves a Notification document *and* emits `notification:new` to the user's room, so notifications survive a refresh and also arrive instantly.

**Auth design:** passwords are hashed with bcrypt (12 rounds). The JWT is signed with `JWT_SECRET` and stored in an **httpOnly, SameSite cookie**, so JavaScript can't read it, which limits what an XSS bug could steal. Email verification and password-reset tokens are random 32-byte values; only their SHA-256 hash is stored, and they expire (24 h / 30 min). Changing the password invalidates older JWTs (`passwordChangedAt`). Registration can be restricted to university domains (`ALLOWED_EMAIL_DOMAINS`).

## 2. Database schema

| Collection | Key fields | Indexes |
|---|---|---|
| **User** | name, email (unique), password (bcrypt, `select:false`), role (`student`/`admin`), department, semester, rollNumber, bio, avatar, isVerified, isActive, bookmarks[→Resource], lastLoginAt, passwordChangedAt, hashed verification/reset tokens + expiry | email (unique), role, text(name,email,rollNumber) |
| **Task** | user→User, title, description, subject, type (`task`/`assignment`), priority (`low`/`medium`/`high`), priorityRank (1–3, derived), status (`todo`/`in_progress`/`completed`), dueDate, reminderAt, reminderSent, deadlineNotified, completedAt, tags[] | {user,dueDate}, {user,status}, {reminderAt,reminderSent} |
| **StudyGroup** | name, description, subject, owner→User, members[{user→User, role `owner`/`admin`/`member`, joinedAt}], invites[{user→User, invitedBy→User, createdAt}], isPrivate, maxMembers, tags[], lastActivityAt | members.user, invites.user, text(name,description,subject) |
| **Message** | group→StudyGroup, sender→User, content, type (`text`/`resource`/`system`), resource→Resource | {group, createdAt} |
| **Resource** | title, description, subject, semester, type (notes/pdf/slides/…), file{originalName, filename, mimeType, size}, uploadedBy→User, group→StudyGroup (optional = group-only), downloads, bookmarkCount, tags[] | {subject,semester}, group, uploadedBy, text(title,description,subject,tags) |
| **Event** | title, description, category, venue, organizer, startDate, endDate, registrationDeadline, capacity (0 = unlimited), registrationsCount, isPublished, createdBy→User | startDate, category, text(title,description,venue) |
| **EventRegistration** | event→Event, user→User, reminderSent | **unique {event,user}**, user |
| **Announcement** | title, content, category, department (`All` or a department), semester (0 = all), priority (`normal`/`important`), isPinned, author→User | {department,semester}, {isPinned,createdAt}, text(title,content) |
| **Notification** | recipient→User, type (announcement/deadline/reminder/group_invite/group/event/system), title, message, link, isRead, meta | {recipient,isRead,createdAt}, TTL 90 days |
| **Activity** *(activity history)* | user→User, action, entityType, entityId, description | {user,createdAt}, TTL 180 days |

All schemas use `timestamps: true`, enum/length/range validators, and `ObjectId` refs.

## 3. Relationships

```
User 1───* Task                    (a student owns their tasks)
User *───* StudyGroup              (embedded members[] with a role; invites[])
StudyGroup 1───* Message *───1 User (chat history; sender)
User 1───* Resource *───0..1 StudyGroup  (group-only materials if group is set)
User *───* Resource                (bookmarks[] on User; bookmarkCount on Resource)
Event 1───* EventRegistration *───1 User (join collection, unique pair)
User(admin) 1───* Event / Announcement   (createdBy / author)
User 1───* Notification, User 1───* Activity
```

Design decisions:
- **Embedded members** in StudyGroup: a group has a bounded number of members (`maxMembers ≤ 200`), and membership is always read together with the group, so embedding avoids a join. **Messages are a separate collection** because they grow without limit and are paginated.
- **EventRegistration is its own collection**, not an array on Event: a unique compound index blocks double registration, participant lists can be paginated, and "my registrations" is a cheap indexed query. `registrationsCount` is kept as a counter on Event and updated with an atomic conditional `$inc`, which enforces capacity without race conditions.
- **Bookmarks are an array on User**: it is small and per-user, and reading it is a single lookup.
- **priorityRank** is a numeric copy of the priority enum, so MongoDB can sort by importance.

## 4. API overview

The base path is `/api`. Every route except the public auth routes requires authentication. (A) means admin only. See [API.md](API.md) for the full request/response reference.

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password/:token`, `PATCH /auth/update-password` |
| Users | `PATCH /users/me`, `POST /users/me/avatar`, `GET /users/search?q=`, `GET /users/me/bookmarks` |
| Dashboard | `GET /dashboard` |
| Tasks | `GET /tasks` (filter/sort/paginate), `POST /tasks`, `GET /tasks/stats`, `GET /tasks/smart`, `GET /tasks/subjects`, `GET/PATCH/DELETE /tasks/:id`, `PATCH /tasks/:id/toggle` |
| Groups | `GET /groups`, `POST /groups`, `GET /groups/invites`, `GET/PATCH/DELETE /groups/:id`, `POST /groups/:id/join`, `POST /groups/:id/leave`, `POST /groups/:id/invite`, `POST /groups/:id/invite/respond`, `PATCH/DELETE /groups/:id/members/:userId`, `GET/POST /groups/:id/messages` |
| Resources | `GET /resources`, `POST /resources` (multipart), `GET/PATCH/DELETE /resources/:id`, `GET /resources/:id/download`, `POST /resources/:id/bookmark` |
| Events | `GET /events`, `GET /events/registered`, `POST /events` (A), `GET /events/:id`, `PATCH/DELETE /events/:id` (A), `POST/DELETE /events/:id/register`, `GET /events/:id/participants` (A) |
| Announcements | `GET /announcements`, `POST /announcements` (A), `GET /announcements/:id`, `PATCH/DELETE /announcements/:id` (A) |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id` |
| Insights | `GET /analytics/me`, `GET /calendar?start&end`, `GET /search?q=`, `GET /activity` |
| Admin (A) | `GET /admin/stats`, `GET /admin/users`, `GET/PATCH/DELETE /admin/users/:id`, `GET /admin/resources` |

**Socket.io events.** Client → server: `group:join`, `group:leave`, `message:send` (with ack), `typing`. Server → client: `notification:new`, `message:new`, `typing`, `group:updated`.

## 5. Folder structure

```
fullStack_5sem_project/
├── README.md
├── docs/            ARCHITECTURE.md · API.md · MODULES.md · DEPLOYMENT.md
├── server/
│   ├── server.js            # HTTP + Socket.io bootstrap, DB connect, cron
│   ├── app.js               # Express app (exported for tests)
│   ├── config/              # env.js, db.js
│   ├── models/              # 10 Mongoose models
│   ├── controllers/         # one per module
│   ├── routes/              # one router per module + index.js
│   ├── middleware/          # auth, validate, upload, rateLimit, error
│   ├── validators/          # express-validator rule sets
│   ├── services/            # email, notification, activity, priority, reminder, socket
│   ├── sockets/             # socket.io event handlers
│   ├── utils/               # ApiError, asyncHandler, pagination, constants, token, seed
│   ├── scripts/seed.js
│   ├── tests/               # Jest + Supertest + mongodb-memory-server
│   └── uploads/             # runtime file storage (git-ignored)
└── client/
    ├── index.html · vite.config.js · tailwind.config.js
    └── src/
        ├── api/             # axios instance + endpoint functions
        ├── context/         # Auth, Theme, Socket
        ├── hooks/           # useAsync, useDebounce
        ├── components/
        │   ├── ui/          # Button, Input, Modal, Badge, Card, Pagination, …
        │   ├── layout/      # AppLayout, Sidebar, Topbar, NotificationBell
        │   └── <feature>/   # TaskForm, EventForm, ChatPanel, …
        ├── pages/           # auth/, dashboard, tasks, groups, resources, events, …, admin/
        ├── routes/          # ProtectedRoute, AdminRoute, GuestRoute
        └── utils/           # formatting, constants
```
