# GTU Papers & Syllabus — Downloader (Next.js)

A production-quality Next.js rebuild of the GTU paper downloader. Pick a
course, enter subject codes, and download previous-year GTU question
papers plus the syllabus — every format in one fetch, no option to pick.

Replaces the legacy `gtu-web-main` Express app while preserving its download
behavior (sessions, merging, TTL cleanup) plus the paper.py syllabus flow.
The Python bulk tool (`paper.py` in the parent folder) is untouched.

## Tech stack

| Concern      | Choice                                              |
|--------------|-----------------------------------------------------|
| Framework    | Next.js 16 (App Router), React 19, TypeScript       |
| Styling      | Tailwind CSS 4, CSS-variable design tokens          |
| Icons        | lucide-react                                        |
| Motion       | framer-motion (entry transitions only)              |
| Validation   | zod (client + server share one schema)              |
| PDF merging  | pdf-lib (server)                                    |
| Bot guard    | Cloudflare Turnstile, verified server-side          |
| Tests        | vitest (pure logic: parsing, schemas, URL state)    |

Every dependency has a job — nothing was added for fashion.

## Getting started

```bash
cp .env.example .env   # fill in values (see below)
npm install
npm run dev            # http://localhost:3000
```

| Command           | Purpose                              |
|-------------------|--------------------------------------|
| `npm run dev`     | Local development server             |
| `npm run build`   | Production build                     |
| `npm start`       | Serve the production build           |
| `npm run lint`    | ESLint                               |
| `npm run typecheck` | Strict TypeScript check            |
| `npm test`        | Vitest unit tests                    |

## Environment variables

| Variable                        | Scope  | Required | Purpose                                              |
|---------------------------------|--------|----------|------------------------------------------------------|
| `NEXT_PUBLIC_APP_URL`           | Public | No       | Canonical URL for metadata/sitemap                   |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`| Public | For bots | Turnstile site key; empty disables verification      |
| `TURNSTILE_SECRET_KEY`          | Server | With above | Turnstile secret (never add `NEXT_PUBLIC_` prefix) |
| `DOWNLOAD_DIR`                  | Server | No       | PDF temp dir (default: OS temp `gtu-papers/`)        |

With no Turnstile keys set, verification is skipped — convenient for local
development. In production, set both keys to enforce the human check.

## Project structure

```text
src/
├── app/                    # Routes (thin: composition + metadata only)
│   ├── page.tsx            # Home: hero + <Downloader/>
│   ├── how-to-use/         # Guide + troubleshooting (static)
│   ├── papers/[course]/[subject]/  # Deep links with SEO metadata
│   └── api/
│       ├── download/       # POST: validate → fetch → merge → store
│       ├── files/[...]/    # GET: serve a generated PDF
│       ├── verify-turnstile/ # GET status / POST token exchange
│       ├── health/ info/   # Liveness probe + capability doc
├── components/
│   ├── ui/                 # Button, input, badge, card, skeleton, alert
│   ├── layout/             # Header, mobile nav, footer
│   ├── course/ subject/ download/ captcha/ feedback/ home/
├── config/                 # App, routes, API, download, captcha settings
├── constants/              # Courses, deliverables, statuses, storage keys
├── hooks/                  # useDownload, useTurnstile, preferences, course
├── lib/                    # cn, URL state, storage, download client
├── services/               # Client-side captcha service
├── server/                 # Server-only: GTU fetch, merge, store, limits
├── schemas/                # Shared zod validation
├── types/  utils/          # Domain types, formatting/parsing helpers
tests/                      # Vitest suites for pure logic
```

Rules enforced throughout: small focused files, no hard-coded domain values
in JSX/handlers (constants + config instead), comments explain *why*.

## Download architecture

```text
Form → zod validation → POST /api/download
  → 403? show Turnstile once → verify → cookie → retry
  → server fetches https://gtu.ac.in/uploads/{S|W}{year}/{course}/{code}.pdf
     (fallback: https://old26.gtu.ac.in) for 20 sessions (S2017–S2026,
     W2017–W2026) plus the syllabus from the GTU circular host
  → validates %PDF magic header → merges every format (pdf-lib)
  → stores the syllabus alongside → returns file list
  → client renders grouped download links (GET /api/files/:name)
```

- **Deliverables per subject:** 20 singles (S2017–S2026, W2017–W2026) ·
  summer pack · winter pack · 3 merged PDFs (winter-first, interleaved,
  summer-first) · official syllabus — always all of them, nothing to pick.
- **Streaming:** `/api/download` answers with NDJSON (`start` → `file` /
  `unavailable` per landing file → `done`), so rows render progressively
  with skeleton placeholders for files still in flight — never all-at-once.
  Emission order is strict per subject (syllabus verdict gates singles):
  syllabus → singles → season packs → merged winter-first →
  merged summer-first → interleaved.
- **Fail-fast upstream:** 16 parallel fetches (paper.py parity), 10 s
  timeout, retries only for network errors/timeouts — HTTP errors fail
  fast and the fallback host gets one shot, so throttled sessions cannot
  stall the batch.
- **Direct upstream links:** syllabus and singles carry the exact GTU URL
  that served them (`sourceUrl`) — View opens it in a new tab and Download
  saves straight from GTU with no server hop. Only served files get links;
  404 gaps never do. Merged packs exist only here, so they use the server
  view (`?view=1`) and download with loader → saved / retry states.
- **Bulk:** tick checkboxes (per file, per card, or select-all), then save
  selected files one by one or as a single `.zip` (`POST /api/archive` —
  same verification, 10 req/min limit, 130 files / 250 MB cap).
- **Expiry:** generated files are deleted after `fileTtlHours` (6 h) via a
  best-effort sweep on each request — no database, no growth.

## CAPTCHA flow (verify once, not every time)

1. First download without a cookie → API returns `403 verification_required`.
2. The Turnstile widget appears; the user completes it once.
3. `POST /api/verify-turnstile` validates the token with Cloudflare
   server-side and sets an `HttpOnly; SameSite=Lax` cookie (`gtu_tv`, 2 h).
4. Later downloads send the cookie automatically — no widget until expiry.

Secrets never reach the browser; `localStorage` holds only UI preferences
(last course).

## URL architecture

- `/?course=DI&subjects=3160704,3160716` — full state, shareable,
  refresh-safe, back/forward-friendly (replaceState + popstate handling).
- `/papers/DI/3160704` — deep link per subject with SEO metadata.
- Unknown courses/codes → `not-found.tsx`; route crashes → `error.tsx`.
- Invalid `/papers/*` segments are rewritten to the not-found route in
  `src/proxy.ts` *before* streaming, so they return a real HTTP 404
  (calling `notFound()` mid-stream can only produce a soft 404).

## Security

- Server-side Turnstile verification; client state is UX-only.
- Strict zod validation at the API boundary; safe filename regex blocks path
  traversal on `/api/files/*`.
- HMAC-signed `HttpOnly; SameSite=Lax` verification cookie (timestamped,
  2 h TTL) — signature and age are rechecked server-side, so the value
  cannot be forged or extended without the server secret.
- Per-IP rate limits (download 20/min, verify 30/min, files 60/min).
- Security headers (`nosniff`, `DENY` framing, restrictive
  permissions-policy) in `next.config.ts`.
- Upstream `%PDF` + size checks reject HTML error pages posing as PDFs.

## Accessibility & UX

Keyboard-navigable combobox, visible focus rings, skip-to-content link,
`aria-live` status regions, icon+text (never color-only) feedback, layout
-matched skeletons, `prefers-reduced-motion` support, mobile-first layout.
