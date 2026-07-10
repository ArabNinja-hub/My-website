# StudyCore

A secondary-school and university learning platform for students in Zambia and across Africa - documents, videos, quizzes, assignments, and announcements, managed through a real admin dashboard.

This is a full rebuild of the previous prototype. Every feature described below is wired to a real Node/Express backend, a real SQLite database, and real file storage on disk - there is no mock data, no localStorage-based "fake backend", and no placeholder buttons.

## What's real here

- **Authentication**: bcrypt-hashed passwords, JWT sessions stored in an httpOnly cookie (not readable or spoofable from the browser console).
- **Roles**: `ADMIN` and `STUDENT`, stored in the `users` table. The public signup form can only ever create `STUDENT` accounts - the only way to get an admin account is the seeded one (see below) or `npm run make-admin`.
- **Route protection**: `/admin.html` and `/dashboard.html` are gated **server-side** (see `middleware/auth.js` → `requirePageAuth`). An unauthenticated request is redirected before the HTML is ever sent - it isn't just hidden by JavaScript. Every `/api/admin/*` route re-checks the role from the database on every request.
- **File uploads**: real drag-and-drop upload in the admin dashboard, backed by `multer`, saved to `storage/uploads/`, with metadata (title, description, category, subject, course, year, semester, tags, file size, uploader) written to SQLite. Uploads are never served as static files - they can only be reached through the authenticated `/api/resources/:id/download` route, which checks the student's subscription/trial status and logs the download.
- **CRUD**: create, edit (including replacing the file), delete, publish/unpublish - all from the admin table, all hitting real endpoints.
- **Search, filter, sort**: by category, subject, and keyword, with newest/oldest/most-downloaded/title sort - both for students browsing and for admins managing resources.
- **Analytics**: total uploads, total downloads, total users, premium students, revenue, most-downloaded resources, uploads by category - computed live from the database, not hardcoded.
- **Bookmarks**: students can save resources and see them on their dashboard.

## Getting started

```bash
npm install
cp .env.example .env   # then edit .env - see below
npm start
```

The server starts on `http://localhost:3000` (or whatever `PORT` you set).

### First run

On first boot, StudyCore seeds one admin account from your `.env` file:

```
ADMIN_EMAIL=admin@studycore.com
ADMIN_PASSWORD=ChangeMe123!
```

**Log in and change this password immediately** (Dashboard → Change password). If you don't set `ADMIN_PASSWORD` yourself, the default above is used and printed to the console - do not leave it as-is on a real deployment.

To promote another account to admin later, or create an additional admin:

```bash
npm run make-admin -- someone@example.com "Full Name"
```

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on (default 3000) |
| `NODE_ENV` | Set to `production` when deployed - this makes auth cookies `secure` (HTTPS-only) |
| `JWT_SECRET` | **Change this** - a long random string used to sign session tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seeded admin account, created once on first boot |
| `MAX_UPLOAD_MB` | Max file size for uploads (default 250MB) |

## Project structure

```
server.js               entry point - wires routes, serves public/, gates views/
db/index.js              SQLite connection, schema, admin seeding
middleware/auth.js        JWT cookie auth, role checks, page-level gating
middleware/upload.js      multer disk storage + file-type/size limits
routes/auth.routes.js     register, login, logout, me, profile, password, subscribe
routes/resources.routes.js  public browse/search/download/stream/bookmarks
routes/admin.routes.js    admin-only resource CRUD, users, analytics
scripts/make-admin.js     CLI to promote/create admin accounts
public/                  everything served as static files (css, js, marketing pages,
                          student content pages under public/pages/)
views/                   admin.html and dashboard.html - only reachable through the
                          authenticated Express routes in server.js, never as static files
storage/uploads/         uploaded files live here (gitignored) - never served directly
data/                    studycore.sqlite lives here (gitignored)
```

## Deploying

This is a normal Node app - deploy it anywhere that runs Node 18+ (Render, Railway, Fly.io, a VPS, etc).

Two things matter for a real deployment:

1. **Persistent disk.** `data/studycore.sqlite` and `storage/uploads/` must live on a persistent volume, not an ephemeral filesystem - otherwise every deploy wipes your database and uploaded files. Render/Railway/Fly all support mounting a persistent disk; point it at this app's `data/` and `storage/` directories (or update the paths in `db/index.js` and `middleware/upload.js` to point at the mounted volume).
2. **Set real environment variables** - especially `JWT_SECRET`, `ADMIN_PASSWORD`, and `NODE_ENV=production` - before going live.

If you outgrow a single SQLite file (many concurrent admins, very high traffic), the cleanest next step is swapping `better-sqlite3` for a hosted Postgres database and an object store (S3-compatible) for `storage/uploads/` - the route/handler code won't need to change shape, only the `db/` and `middleware/upload.js` implementations.

## Known limitation: mobile money payments are simulated

The subscription flow (`POST /api/auth/subscribe`) creates a real `payments` row and, after a short delay, marks the student's subscription active - this mirrors the original design. Actually charging a phone number requires a merchant account and API credentials with MTN Mobile Money or Airtel Money, which no one can generate on your behalf. When you have those credentials, replace the `setTimeout` block in `routes/auth.routes.js` with a call to the provider's charge API and a webhook handler for their payment-confirmation callback.

## Removed from the previous version

- The entire `src/`, `supabase/` React/TanStack/Supabase scaffold - it was unused boilerplate, never wired to anything on the live site.
- The duplicate `public/` copy of the whole site and the duplicate `pages/admin.html`, `pages/dashboard.html`, `pages/login.html`, `pages/signup.html` - there is now exactly one canonical copy of every page.
- The public "upload" and "post announcement" forms that used to sit directly on `documents.html`, `videos.html`, `announcements.html`, and every subject page - anyone visiting those pages could submit them. Uploading now only exists inside the authenticated, role-gated admin dashboard.
- All `localStorage`-backed "fake backend" code in `js/main.js`, `js/admin.js`, and `js/auth.js` - including the rule that granted admin access based on a hardcoded email address. Roles are now assigned once, server-side, at account creation, and are never re-derived from anything the client sends.
