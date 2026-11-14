# Module Walkthrough

For each module, this explains how it works, which technologies it uses, how the frontend and backend talk to each other, and the key design decisions behind it. It doubles as interview preparation.

---

## 1. Authentication and security

**How it works**
1. `POST /auth/register` validates the input with express-validator and checks the email against the university domain list (`ALLOWED_EMAIL_DOMAINS`). It then creates the user. A Mongoose `pre('save')` hook hashes the password with **bcrypt (12 rounds)**.
2. A 32-byte random verification token is generated. **Only its SHA-256 hash is stored**, and the raw token is emailed as a link (`/verify-email/<token>`). If someone stole the database, they still couldn't use these tokens.
3. Login compares the password with `bcrypt.compare`, refuses suspended or unverified accounts, signs a JWT (`{ id }`, 7 days) and stores it in an **httpOnly, SameSite cookie**.
4. `protect` middleware reads the token (from the cookie or a Bearer header), verifies it, loads the user, and rejects the request if the account is suspended or the password changed after the token was issued (`passwordChangedAt` compared with `iat`).
5. `authorize('admin')` guards admin routes. On the client, `ProtectedRoute`, `AdminRoute` and `GuestRoute` mirror these rules for navigation.
6. Password reset reuses the same hashed one-time-token design, with a 30-minute expiry.

**Technologies:** Express, jsonwebtoken, bcryptjs (a pure-JS bcrypt with identical hashes and no native build step), express-validator, nodemailer, cookie-parser.

**Frontend ↔ backend:** `AuthContext` calls `GET /auth/me` on load to restore the session from the cookie. Axios runs with `withCredentials: true`. A response interceptor turns any 401 into an `auth:unauthorized` event, and `AuthContext` listens for it and logs the user out.

**Design decisions**
- *httpOnly cookie vs localStorage:* JavaScript can't read the token, so an XSS bug can't steal it. CSRF risk is reduced by `SameSite=Lax`, a strict CORS allow-list, and a JSON-only API.
- Login and forgot-password return the **same message** whether or not the account exists, which prevents account enumeration.
- Extra layers: **Helmet** (security headers), **express-rate-limit** (stricter on auth), **express-mongo-sanitize** (strips `$` operators against NoSQL injection), escaped regex for every search, and a 100 KB body limit.
- Development convenience: when SMTP isn't configured, the API returns the verification or reset link (`devLink`) so the whole flow can be tested. This is disabled in production.

## 2. Student dashboard

`GET /dashboard` runs about ten independent queries **in parallel** (`Promise.all`) and returns everything the home page needs in one round trip: stats (a `$facet` aggregation), upcoming deadlines, pending assignments, the top-3 *smart focus* tasks, events with an `isRegistered` flag, announcements for the student's audience, and a 7-day completion series for the chart.

On the frontend, `Dashboard.jsx` uses the `useAsync` hook, which handles loading, error and data, and supports silent reloads and optimistic updates. It also subscribes to live notifications through `SocketContext.onNotification`, so a new announcement refreshes the page without a reload. The page shows skeleton loaders while loading, and an error state with a retry button.

## 3. Tasks and assignments

- **Model:** `Task` has priority, status, type, dueDate and reminderAt. A `pre('validate')` hook keeps `priorityRank`, `completedAt`, `deadlineNotified` and `reminderSent` consistent. An `isOverdue` virtual is computed on read.
- **Filtering:** `buildFilter` turns query parameters into a Mongo filter (`due=overdue|today|week|upcoming`, status, priority, subject, search). Sorting uses the numeric `priorityRank`, because sorting the enum string would be alphabetical.
- **Smart prioritisation** (`services/priorityService.js`): a transparent formula combines importance and exponential deadline urgency, with a boost for overdue work. Each task gets a score, a label (*Do now / Do next / Plan / Later*) and a human-readable reason ("High priority · due in 20h"). It is pure and unit-tested.
- **Reminders** (`services/reminderService.js`): a node-cron job runs every 5 minutes. It sends custom reminders, deadline-within-24h alerts, and event-tomorrow alerts. Flags ensure each alert is sent **exactly once** (this is tested).
- **UI:** tabs (Pending, Upcoming, Overdue…), filters, sorting, a debounced search, pagination, a create/edit modal, and an optimistic completion toggle.

## 4. Calendar

`GET /calendar?start&end` returns tasks due in the range plus events that **overlap** it (`startDate ≤ end && endDate ≥ start`), merged into one list. `Calendar.jsx` builds a Monday-first month grid with date-fns. Multi-day events appear on every day they cover. Items can be filtered by kind, and the selected day's agenda is shown on the side.

## 5. Study groups and real-time chat

- **Schema choice:** members and invites are **embedded** in `StudyGroup`. Groups are small and always read with their members, so embedding avoids a join. **Messages are a separate collection**, because they grow without limit and are paginated with a cursor (`before=<createdAt>`), which stays fast because of the `{group, createdAt}` index.
- **Roles:** owner, admin and member. Permission checks live in model methods (`isMember`, `canManage`). Ownership can be transferred, and the owner can't leave without transferring it.
- **Private groups and invitations:** an invite adds `{user, invitedBy}` and sends a `group_invite` notification in real time. The invitee accepts or declines from the Groups → Invitations tab or from the group page.
- **Socket.io flow:**
  1. The handshake is authenticated with the same JWT cookie (`io.use` → `getUserFromToken`).
  2. Each socket joins `user:<id>`. The group page emits `group:join`, the server **checks membership**, then joins `group:<id>`.
  3. `message:send` → the shared `messageService.createMessage` saves the message, populates it, and broadcasts `message:new` to the room. The sender gets an **acknowledgement** (a timeout surfaces as an error). REST `POST /groups/:id/messages` uses the same service as a fallback when the socket is down.
  4. Typing indicators are broadcast with `socket.to(room)`, which excludes the sender.
- **UI:** `ChatPanel` sticks to the bottom only if you're already near it, keeps the scroll position when loading older messages, separates days, groups consecutive messages, and shows system messages ("X joined"). Shared files appear in the chat as download cards.

## 6. Notes and resource sharing

- **Upload security** (`middleware/upload.js`): Multer disk storage with **random server-side filenames**. Both the **extension and the MIME type** must be on an allow-list. There is a 15 MB limit and an upload rate limit. Files that fail validation are deleted right away.
- **Access control:** files are **never served statically**. `GET /resources/:id/download` checks access first (public, or a member of the owning group), uses `path.basename` to prevent path traversal, increments the download counter, and streams the file with `res.download`. The on-disk filename is stripped from JSON responses.
- **Bookmarks:** an array on `User` (`$addToSet` / `$pull`) plus a denormalised `bookmarkCount` for "most bookmarked" sorting.
- **Organisation:** filter by subject, semester and type; text search across title, description, subject and tags; sort by newest, popular, bookmarked or title.
- **Client:** drag-and-drop upload with progress reporting (Axios `onUploadProgress`). Downloads go through Axios as a Blob, so the auth cookie is sent.

## 7. Campus events

- `EventRegistration` is its own collection with a **unique `{event, user}` index**, so a student can't register twice even if two requests arrive at the same moment.
- **Capacity without race conditions:** `findOneAndUpdate({ _id, $or: [{capacity: 0}, {$expr: {$lt: ['$registrationsCount', '$capacity']}}] }, {$inc: {registrationsCount: 1}})` only succeeds when a seat is free. If creating the registration then fails, the seat is rolled back.
- Deadlines, past events and drafts (`isPublished`) are enforced on the server. The client receives `registrationOpen`, `spotsLeft`, `isRegistered` and `isPast` flags.
- Admins can create, edit and delete events, see the participant list and export it to CSV. Students are notified when an event is created, rescheduled or cancelled, and 24 hours before it starts (cron).

## 8. Announcements

The admin chooses a category, a priority, and a target audience (department and semester, where `'All'` and `0` mean everyone). A static `audienceFilter(user)` method is reused by the list, detail, dashboard and search endpoints, so students only see what targets them. Publishing **fans out notifications** with a single `insertMany` and emits a socket event to each recipient's room. Pinned announcements sort first, and a notification link (`?highlight=<id>`) scrolls to and highlights the announcement.

## 9. Real-time notifications

`notificationService.notify()` / `notifyMany()` **persist first, then emit**, so notifications are never lost when a user is offline, and they arrive instantly when the user is online. `SocketContext` keeps the unread counter, shows a toast, and lets pages subscribe (`onNotification`) to refresh themselves. The bell dropdown, the full notifications page (filters, mark read or all read, delete, clear read), and a TTL index (90 days) complete the module.

## 10. Admin dashboard and analytics

- `GET /admin/stats` runs 15 aggregations in parallel: user counts by role and status, task completion, resource downloads and storage, event registrations, a 6-month user growth series (`$year/$month`, timezone-aware), students by department, uploads by subject, top events, and 14-day activity.
- User management covers search and filters, role toggling, suspend/reactivate, manual verification, a detail modal with stats and activity, and a **cascading delete**: owned groups are handed to the next admin or member, event seats are released, and files are removed. Admins can't demote, suspend or delete themselves.
- Resource moderation lists every upload, including group-only files, with size, downloads and visibility.
- **Personal analytics** (`/analytics/me`): an 8-week created vs completed trend, on-time rate, a priority breakdown, a subject stacked bar, 30-day activity, and collaboration totals.
- **Charts** use Recharts with a categorical palette that was **validated for colour-blind separation and contrast**. Dark mode has its own palette, not an inverted one. Every chart has tooltips and legends, so colour is never the only cue.

## 11. Global search and activity history

`GET /search` queries five collections in parallel, applying the **same visibility rules** as each module (group-only resources, private groups, the announcement audience, your own tasks). The topbar shows instant grouped results (debounced, opened with Ctrl/⌘+K), and `/search` shows the full results page.

`activityService.logActivity()` is called from controllers as fire-and-forget, so logging never slows down or breaks a request. The activity page renders a day-grouped timeline, and entries expire after 180 days (TTL).

## 12. Frontend architecture

- **Routing:** React Router v6 with route-level **code splitting** (`React.lazy`). Recharts sits in its own chunk.
- **State:** Context API (Auth, Theme, Socket) for global state. Page state stays local, managed by `useAsync` and `useDebounce`. Redux would add ceremony without benefit at this size.
- **Design system:** Tailwind with custom `brand` and `ink` scales and component classes (`.card`, `.btn`, `.input`, `.chip`). Reusable components include Modal, ConfirmDialog, Tabs, Pagination, StatCard, Badge, Avatar, EmptyState, ErrorState and Skeleton.
- **Dark mode:** a `class` strategy, persisted in localStorage, with a pre-paint script in `index.html` that prevents a flash of the wrong theme.
- **UX states:** every data view has a loading skeleton, an empty state with a call to action, and an error state with retry. Mutations show toasts, and some update optimistically.

## 13. Testing

`server/tests` uses **Jest + Supertest + mongodb-memory-server** (a real MongoDB in memory, so no mocks). There are 18 integration tests covering auth (domain check, verification, reset, enumeration, roles, NoSQL injection), tasks (CRUD, ownership isolation, filters, smart scoring, exactly-once reminders), groups (private invite → accept → chat → leave), resources (upload, download, bookmarks, executable rejection), events (capacity, roles), announcements (audience targeting), and the dashboard, analytics, calendar and search endpoints.
