# CampusConnect REST API

**Base URL:** `/api` (dev: `http://localhost:5000/api`, or `http://localhost:5173/api` through the Vite proxy)

**Authentication:** a JWT is issued at login, register (when verification is off), verify-email and reset-password. It is sent automatically as the **httpOnly cookie `cc_token`**. Non-browser clients (Postman, mobile) may instead send `Authorization: Bearer <token>`; the token is also returned in the response body as `data.token`.

**Response envelope**

```jsonc
// success
{ "success": true, "message": "optional human message", "data": { ... } }
// paginated list → data
{ "items": [ ... ], "pagination": { "page": 1, "limit": 12, "total": 42, "pages": 4 } }
// error
{ "success": false, "message": "Readable error", "code": "OPTIONAL_CODE", "errors": [{ "field": "email", "message": "..." }] }
```

**Status codes:** `200` OK · `201` Created · `400` bad request · `401` not authenticated · `403` forbidden (role, suspended, unverified) · `404` not found · `409` duplicate · `413` too large · `422` validation failed · `429` rate limited · `500` server error.

**Rate limits:** 600 req / 15 min per IP on `/api`; 20 failed attempts / 15 min on the auth endpoints; 40 uploads / hour.

Common query parameters on list endpoints: `page` (default 1), `limit` (default varies, max 100), `search`.

---

## Auth — `/api/auth`

| Method | Path | Access | Body / Params | Notes |
|---|---|---|---|---|
| POST | `/register` | Public | `name, email, password, department?, semester?, rollNumber?` | Email must match `ALLOWED_EMAIL_DOMAINS`. The password needs 8+ characters with upper case, lower case and a digit. Returns `{ email, requiresVerification, devLink? }`. `devLink` is only returned in development when SMTP is off. |
| POST | `/login` | Public | `email, password` | Returns `{ user, token }` and sets the cookie. `403 EMAIL_NOT_VERIFIED` if unverified. |
| POST | `/logout` | Public | – | Clears the cookie. |
| GET | `/me` | Auth | – | `{ user }` |
| POST | `/verify-email` | Public | `token` | Verifies, then logs in. |
| POST | `/resend-verification` | Public | `email` | Always gives a generic response, so accounts can't be enumerated. |
| POST | `/forgot-password` | Public | `email` | Sends a reset link valid for 30 min. Generic response. |
| POST | `/reset-password/:token` | Public | `password` | One-time token. Logs the user in. |
| PATCH | `/update-password` | Auth | `currentPassword, newPassword` | Issues a fresh token; older tokens become invalid. |

## Users — `/api/users`

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| PATCH | `/me` | `name?, department?, semester?, rollNumber?, bio?` | Profile update. |
| POST | `/me/avatar` | multipart `avatar` (png/jpg/webp ≤ 2 MB) | Returns the updated user. |
| GET | `/me/bookmarks` | – | Bookmarked resources. |
| GET | `/search?q=` | `q` (≥ 2 chars) | Up to 10 active users (name, email, department). Used for group invites. |

## Dashboard & insights

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | `{ stats, upcomingDeadlines, pendingAssignments, focus (top-3 smart), upcomingEvents, recentAnnouncements, weeklyCompletion }` |
| GET | `/analytics/me` | `{ tasks (stats), completionTrend (8 weeks), activityByDay (30 days), onTimeRate, totals }` |
| GET | `/calendar?start=ISO&end=ISO` | Tasks due in the range, plus published events that overlap it, as `{ id, kind: task\|assignment\|event, title, start, end, … }` |
| GET | `/search?q=&limit=5` | `{ query, total, tasks, resources, groups, events, announcements }`. Only returns items the user is allowed to see. |
| GET | `/activity?entityType=&page=` | The user's activity history (newest first). |

## Tasks — `/api/tasks`

| Method | Path | Body / Query |
|---|---|---|
| GET | `/` | Filters: `status` (`todo`, `in_progress`, `completed`, `pending`), `priority`, `type` (`task`/`assignment`), `subject`, `due` (`overdue`, `today`, `week`, `upcoming`, `none`), `search`. Sort: `sort` = `smart`, `dueDate`, `-dueDate`, `priority`, `-createdAt`, `title`. Plus `page`, `limit`. |
| POST | `/` | `title*, description, subject, type, priority, status, dueDate (ISO), reminderAt (ISO), tags[]` |
| GET | `/stats` | `{ total, completed, pending, inProgress, overdue, dueThisWeek, pendingAssignments, completionRate, byPriority[], bySubject[] }` |
| GET | `/smart?limit=5` | Pending tasks ranked by smart score. Each task carries `smart: { score, label, reason }`. |
| GET | `/subjects` | The user's distinct subjects. |
| GET | `/:id` | Your own task only (otherwise 404). |
| PATCH | `/:id` | Any task field. Send `dueDate: null` to clear it. |
| PATCH | `/:id/toggle` | completed ⇄ todo |
| DELETE | `/:id` | |

**Smart score** = importance (low 3 / medium 6 / high 9) + urgency (overdue 12, otherwise `10·e^(−daysLeft/3)`, no deadline 1) + 1 for assignments. Labels by score: ≥ 15 *Do now*, ≥ 10 *Do next*, ≥ 6 *Plan*, otherwise *Later*.

## Study groups — `/api/groups`

| Method | Path | Body / Query | Access |
|---|---|---|---|
| GET | `/` | `search, subject, mine=true, page, limit` | Lists public groups, plus private groups you belong to or are invited to. |
| POST | `/` | `name*, subject*, description, isPrivate, maxMembers (2–200), tags[]` | The creator becomes the owner. |
| GET | `/invites` | – | Your pending invitations. |
| GET | `/subjects` | – | |
| GET | `/:id` | – | A private group is visible only to members, invitees and admins. |
| PATCH | `/:id` | Same fields as create | Group owner or group admin |
| DELETE | `/:id` | – | Owner or platform admin. Also deletes the group's messages and files. |
| POST | `/:id/join` | – | Public groups, or private groups you were invited to |
| POST | `/:id/leave` | – | Members. The owner must transfer ownership first. |
| POST | `/:id/invite` | `email` | Owner or group admin. Sends a `group_invite` notification. |
| POST | `/:id/invite/respond` | `accept: boolean` | The invitee |
| PATCH | `/:id/members/:userId` | `role: owner\|admin\|member` | Owner (`owner` transfers ownership) |
| DELETE | `/:id/members/:userId` | – | Owner, or a group admin removing a plain member |
| GET | `/:id/messages` | `before=ISO, limit≤100` | Members. Returns `{ items (oldest→newest), hasMore }`. |
| POST | `/:id/messages` | `content` (1–2000) | Members. REST fallback; the normal path is Socket.io. |

## Resources — `/api/resources`

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/` | `search, subject, semester, type, group, mine=true, bookmarked=true, sort (newest, oldest, popular, bookmarked, title), page, limit` | Each item carries `isBookmarked` and `canEdit`. Group-only files appear only for members. |
| GET | `/filters` | – | `{ subjects[], semesters[] }` |
| POST | `/` | **multipart**: `file*` + `title*, subject*, semester*, type, description, tags (comma separated), group?` | Max 15 MB. Allowed types: pdf, doc(x), ppt(x), xls(x), txt, md, zip, png, jpg. Both MIME type and extension are checked. |
| GET | `/:id` | – | |
| PATCH | `/:id` | metadata fields | Uploader or admin |
| DELETE | `/:id` | – | Uploader or admin. Removes the file from disk and from everyone's bookmarks. |
| GET | `/:id/download` | – | Streams the file (`Content-Disposition: attachment`) and increments `downloads`. |
| POST | `/:id/bookmark` | – | Toggles the bookmark → `{ isBookmarked }` |

## Events — `/api/events`

| Method | Path | Body / Query | Access |
|---|---|---|---|
| GET | `/` | `scope (upcoming\|past\|all), category, search, page, limit` | Each item carries `isRegistered, spotsLeft, isPast, registrationOpen`. |
| GET | `/registered` | – | Events you have registered for |
| POST | `/` | `title*, description*, venue*, startDate*, endDate*, category, organizer, registrationDeadline, capacity (0 = unlimited), isPublished` | **Admin**. Notifies all students. |
| GET | `/:id` | – | |
| PATCH | `/:id` | Any field above | **Admin**. Registrants are notified if the date or venue changes. |
| DELETE | `/:id` | – | **Admin**. Registrants are notified of the cancellation. |
| POST | `/:id/register` | – | Uses an atomic capacity check. `400` if the event is full, closed or you are already registered. |
| DELETE | `/:id/register` | – | Cancels your registration. |
| GET | `/:id/participants` | `page, limit≤500` | **Admin**. Returns a list of registered students. |

## Announcements — `/api/announcements`

| Method | Path | Body / Query | Access |
|---|---|---|---|
| GET | `/` | `category, priority, search, page` (admins can also filter by `department, semester`) | Students only see announcements for `department ∈ {All, theirs}` and `semester ∈ {0, theirs}`. |
| POST | `/` | `title*, content*, category, department ('All' or a department), semester (0 = all), priority (normal\|important), isPinned` | **Admin**. Notifies the target audience in real time and returns `recipients`. |
| GET | `/:id` | – | |
| PATCH | `/:id` | Same fields as create | **Admin** |
| DELETE | `/:id` | – | **Admin** |

## Notifications — `/api/notifications`

| Method | Path | Notes |
|---|---|---|
| GET | `/?unread=true&type=&page=` | Returns `{ items, pagination, unread }` |
| GET | `/unread-count` | `{ count }` |
| PATCH | `/read-all` | |
| PATCH | `/:id/read` | |
| DELETE | `/:id` | |
| DELETE | `/read` | Deletes every read notification |

Types: `announcement`, `deadline`, `reminder`, `group_invite`, `group`, `event`, `system`. Notifications expire automatically after 90 days (TTL index).

## Admin — `/api/admin` (admin only)

| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | Platform totals, plus chart series: `userGrowth`, `byDepartment`, `resourcesBySubject`, `topEvents`, `activityTrend` |
| GET | `/users` | `search, role, department, status (active\|suspended\|unverified), sort (newest\|oldest\|name\|lastLogin), page` |
| GET | `/users/:id` | `{ user, stats, recentActivity }` |
| PATCH | `/users/:id` | `role?, isActive?, isVerified?`. You cannot demote or suspend yourself. |
| DELETE | `/users/:id` | Cascading cleanup: tasks, uploads, registrations and notifications are deleted, and owned groups are transferred to another member. |
| GET | `/resources` | Every upload, including group files. `search, sort (newest\|popular\|size)`. |

## Socket.io

Connect to the same origin as the API. The JWT cookie is sent automatically; non-browser clients use `io(url, { auth: { token } })`.

| Direction | Event | Payload |
|---|---|---|
| client → server | `group:join` | `{ groupId }`, ack `{ ok, error? }`. Membership is verified. |
| client → server | `group:leave` | `{ groupId }` |
| client → server | `message:send` | `{ groupId, content }`, ack `{ ok, message \| error }` |
| client → server | `typing` | `{ groupId, isTyping }` |
| server → client | `notification:new` | Notification document (sent to room `user:<id>`) |
| server → client | `message:new` | Populated message (sent to room `group:<id>`) |
| server → client | `typing` | `{ groupId, isTyping, user: { _id, name } }` |
| server → client | `group:updated` / `group:deleted` | `{ groupId }` |

## Example (curl)

```bash
# login and keep the cookie
curl -c jar -H "Content-Type: application/json" \
  -d '{"email":"aarav@campusconnect.edu","password":"Student@123"}' http://localhost:5000/api/auth/login

# create a task
curl -b jar -H "Content-Type: application/json" \
  -d '{"title":"Lab report","priority":"high","dueDate":"2026-12-01T17:00:00Z"}' http://localhost:5000/api/tasks

# upload a PDF
curl -b jar -F title="OS notes" -F subject="Operating Systems" -F semester=5 -F file=@notes.pdf http://localhost:5000/api/resources
```
