# StudyCore

StudyCore is a multi-page learning platform (courses, documents, videos, dashboard, and announcements) built with TanStack Start, React, Tailwind CSS, and Supabase.

This project was originally scaffolded in Lovable and has been prepared here as a standalone codebase you can push to your own GitHub repository and deploy under your own domain.

## Tech stack

- **Framework:** TanStack Start (React 19 + TanStack Router, SSR via Nitro)
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Backend/data:** Supabase (Postgres + Auth), see `supabase/migrations`
- **Package manager:** Bun (a `bun.lock` is included; npm/pnpm/yarn also work if you delete `bun.lock` and regenerate your own)

## 1. Getting the code onto your own GitHub

```bash
cd studyflow-control-main
git init
git add .
git commit -m "Initial commit: StudyCore standalone"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env` is intentionally excluded from git (see `.gitignore`) so your Supabase credentials are never committed. Use `.env.example` as the template.

## 2. Environment variables

Copy the template and fill in your Supabase project's values (found in your Supabase project settings under API):

```bash
cp .env.example .env
```

Required variables:

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | client + server | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | client + server | The anon/publishable key — safe to expose in the browser, access is governed by Row Level Security (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (`client.server.ts`) | **Never** prefix this with `VITE_` and never expose it to the browser — it bypasses RLS |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | tooling | Your Supabase project ref |

Your existing Supabase project (`olzguopmbkqavrqkfvle`) keeps working exactly as it did in Lovable — this app just connects to Supabase directly, the same way it already did.

## 3. Install & run locally

```bash
bun install       # or: npm install / pnpm install
bun run dev       # starts the Vite dev server
```

Other scripts:

```bash
bun run build       # production build
bun run build:dev   # development-mode build
bun run preview     # preview the production build locally
bun run lint         # eslint
bun run format       # prettier --write
```

## 4. Deployment

The build is powered by Nitro, which supports many deployment targets (Cloudflare, Vercel, Netlify, Node, and more). Out of the box this project builds for Cloudflare (Workers/Pages). You have two straightforward paths for your own domain:

**Option A — Cloudflare (matches current build target)**
1. Push the repo to GitHub.
2. Create a Cloudflare Pages/Workers project connected to your GitHub repo.
3. Build command: `bun run build` (or `npm run build`). Output directory: `dist` (Nitro's Cloudflare output).
4. Add the environment variables from step 2 in the Cloudflare project settings.
5. Attach your own domain in the Cloudflare dashboard.

**Option B — Vercel / Netlify / any Node host**
Nitro can target other platforms by changing the `server` preset. If you'd rather deploy to Vercel or Netlify, let me know and I can adjust the Nitro preset in `vite.config.ts` for that target — this is a one-line config change, not a rebuild.

In all cases, remember to set the environment variables from `.env.example` in your hosting provider's dashboard (never commit the real `.env`).

## 5. What changed from the Lovable export

To make this an independent project, the following were removed or adjusted — no application features, UI, styling, components, or Supabase logic were changed:

- Removed the `.lovable/` project-tracking folder and `AGENTS.md` (Lovable-sync instructions), since this repo no longer syncs with Lovable.
- Removed `src/lib/lovable-error-reporting.ts` and its single call site. This hook only ever sent data when running inside Lovable's own preview iframe (it checked for a `window.__lovableEvents` object that only Lovable injects) — outside of Lovable it was already a no-op, so behavior is unchanged.
- Reworded a few internal comments/error messages that said "Lovable Cloud" to plain "Supabase" — cosmetic text only, no logic changes.
- Renamed the `name` field in `package.json` from the generic template name `tanstack_start_ts` to `studycore`.
- Added `.env.example` and excluded `.env` from git so credentials aren't committed.

**Left intentionally unchanged:** `vite.config.ts` still uses the `@lovable.dev/vite-tanstack-config` package. This is a normal, publicly published npm package (not a proprietary Lovable-only service) that bundles several plugins together (TanStack Start, React, Tailwind, path aliases, Nitro/Cloudflare build target, and a dev-only component tagger). It installs and works fine outside of Lovable with no account or connection to Lovable required. Rewriting it by hand would mean manually re-assembling all of those plugins and risking build breakage, which conflicts with keeping the app "exactly the same." If you'd prefer to remove this dependency entirely and use plain `@tanstack/react-start`/`vite` plugins directly, I'm happy to do that as a separate, careful step — just ask.

## 6. Role-based access control (Admin vs. Student)

Roles live in the `user_roles` table in Supabase and are enforced by Row Level Security (RLS) — the policies from the original migrations already restricted `INSERT`/`UPDATE`/`DELETE` on `videos`, `documents`, `quizzes`, `assignments`, `announcements`, and `user_roles` to admins only, so the backend was already safe against students bypassing the UI to write data directly.

What changed on the frontend to match:

- Removed the legacy, unguarded upload/edit panels that were scattered across student pages (`videos.html`'s video upload form, `announcements.html`'s "post an announcement" form, and the mathematics subject page's "owner-only upload panel"). These wrote to the browser's local storage only, were gated by a stale, hardcoded email/role check unrelated to the real Supabase-backed admin account, and were present in the page markup regardless of who was logged in.
- The Admin Dashboard (`admin.html`) is now the only place content can be created, edited, published/unpublished, or deleted — a new "Manage & organize learning materials" section was added there with per-item Edit / Publish-Unpublish / Delete controls for videos, documents, quizzes, assignments, and announcements (previously the dashboard could only publish new items, not manage existing ones).
- Student-facing pages (`documents.html`, `videos.html`, subject pages, `announcements.html`, `assignments.html`, `quizzes.html`) are now pure read/download views with no admin controls in the markup at all.
- Fixed a few pre-existing bugs along the way where some helper functions were referenced but never defined, which had been silently breaking the documents/videos/assignments/quizzes list pages.

### Admin email no longer exposed to the browser

The admin account's email address was previously hardcoded as a plaintext constant in `js/auth.js` — a file loaded on every page — even though nothing in the app actually used it (role lookups already went through Supabase). That meant anyone could find the admin's email via view-source or the browser dev tools. This has been removed:

- Deleted the hardcoded `ADMIN_EMAIL` constant and unused `isAdminEmail()` helper from `js/auth.js`.
- Removed the literal admin email from the visible copy on the Admin Dashboard page.
- The Login and Sign Up forms never contained the admin email, a pre-filled value, or a placeholder referencing it — they're the same generic forms for every user.
- The only place an email is ever mapped to the admin role is the `handle_new_user()` database trigger in `supabase/migrations` — this runs entirely server-side in Postgres and is never shipped to any client.
- Role is determined strictly *after* a successful `signInWithPassword()`/`signUp()` call, by querying the RLS-protected `user_roles` table with the now-authenticated session (see `fetchRole()` / `buildUser()` in `js/auth.js`), then used to redirect to `admin.html` or `dashboard.html` accordingly. This was already the existing design and required no changes — only the redundant, exposed constant needed removing.
