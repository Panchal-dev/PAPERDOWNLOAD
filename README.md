# GTU Papers & Syllabus Downloader (fixed build)

Next.js 16 app that fetches previous-year GTU question papers and the official
syllabus for any course + subject codes. No login, no captcha, no database.
Requires Node 22.23.4+ / 24.22.1+ / 26.12.1+ (Node 24 LTS recommended).

## What each subject gets

- Syllabus
- Single paper for every session found (2017 up to the current year, computed at run time)
- Merge Summer: all summer papers, oldest → newest, one PDF
- Merge Winter: all winter papers, oldest → newest, one PDF
- Merge All: every paper, oldest → newest (S2017, W2017, S2018 …), one PDF

Select any files (checkboxes / Select all) and pick one of three actions:

1. Individually: each file is saved directly (no new tab)
2. Merge in order: one PDF (per subject: syllabus first, then papers oldest → newest; duplicates removed)
3. .zip: one archive built in the browser with a progress bar

## How it works (and why)

```
Browser ──Range 0-1023──> old26.gtu.ac.in/uploads/<S|W><year>/<course>/<code>.pdf
   │                      (discovery: %PDF header + total size only; GTU sends CORS *)
   ├──GET (full file)────> same URL, only on Download / View / merge
   ├──GET──> /api/pdf/<course>/<code>/SYLLABUS   (our server streams the S3 syllabus,
   │                                            Content-Disposition: attachment; S3 has no CORS)
   ├── @cantoo/pdf-lib in a module Web Worker -> Merge Summer / Winter / All / Merge in order
   ├── client-zip                             -> .zip with progress
   └── blob: URL + <a download>               -> saves with the right filename, page never navigates
```

- GTU's file hosts answer **403 to many datacenter IPs** (checked 2026-10-30 from a
  Google Cloud server: 403 even with a browser user-agent; also 403 for
  "HeadlessChrome" user-agents). Visitors' own browsers are allowed, so papers are
  fetched client-side. The server only proxies the syllabus. If a browser fetch
  fails, the app retries and then tries `/api/pdf/...` on the server as a fallback.
- Discovery only downloads the first 1 KB of each paper (a Range probe) and
  records its size. The full PDF is fetched on the first Download, View or
  merge, so listing 100+ papers no longer costs ~200 MB of mobile data.
  If GTU ignores or rejects Range, the engine automatically falls back to the
  old full-download behaviour (the probe result is cached for the session).
- Full PDFs are kept as `Blob`s in an LRU cache capped at 256 MB, so the
  browser can spill large files to disk instead of pinning them in the JS heap.
  Everything disappears on reload (the "temporary cache"). The syllabus proxy
  sets `Cache-Control: s-maxage=86400`, so a CDN (Vercel) keeps a copy for a
  day at most.
- No server-side merge or ZIP, so no serverless timeout / 4.5 MB body limit / RAM
  issue. Merging runs in a module Web Worker; if a worker cannot start, it
  falls back to the main thread.
- `/` is statically rendered. Shareable `?course=…&subjects=…` state is read in
  the client inside a `<Suspense>` boundary, not with `await searchParams`.

## Security

- A CSP is sent from `next.config.ts`. `connect-src` allows only this origin
  plus the GTU paper host, so an injected script cannot exfiltrate data.
  `script-src` uses `'unsafe-inline'` because Next's bootstrap and the no-flash
  theme script are inline; a nonce would force every page to be dynamic.
- The PDF proxy follows no redirects (`redirect: "manual"`), so an upstream
  redirect cannot move a request off the allow-listed hosts.
- `/api/visitors` accepts only UUID visitor ids, caps the request body at 1 KB,
  runs `PFADD` + `PFCOUNT` in one Upstash pipeline, and is rate-limited with
  `@upstash/ratelimit`. The in-memory limiter used by `/api/pdf` prefers
  `x-real-ip` and the last `x-forwarded-for` entry, so it is not spoofable by a
  client-supplied first value.
- `/api/health` no longer exposes the Node version.

## Run

```bash
npm ci                 # Node 22.23.4+ / 24.22.1+ / 26.12.1+
npm run dev            # http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run build && npm start
```

npm is the only supported package manager: `package-lock.json` is the single
lockfile and `packageManager` pins the npm version.

Self-contained Node server (any VPS / box):

```bash
NEXT_OUTPUT=standalone NEXT_PUBLIC_APP_URL=https://your.domain npm run build
cp -r .next/static .next/standalone/.next/static
cd .next/standalone && PORT=3000 HOSTNAME=0.0.0.0 node server.js
```

## Deploy to Vercel

Import the repo, framework Next.js, no build settings needed. Environment variables:

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | recommended | Canonical site URL for metadata, robots.txt and sitemap.xml (default `https://paper.devang.live`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Visitor counter; hidden when unset |

No Turnstile keys any more; the captcha was removed.

## Structure

```
src/app/api/pdf/[course]/[subject]/[session]/route.ts  streamed PDF proxy (syllabus; paper fallback)
src/app/api/visitors/route.ts  UUID-validated, rate-limited HyperLogLog counter
src/lib/paper-engine.ts     Range probes, lazy full fetch, Blob cache, merge orchestration
src/lib/pdf-merge.ts        shared pdf-lib merge routine
src/lib/merge-worker.ts     module Web Worker for merging
src/lib/zip-client.ts       client-zip archive
src/lib/sessions.ts         session range up to the current year + chronological order
src/server/rate-limit.ts    in-memory limiter + trusted client-key derivation
src/components/download/    results panel, rows, bulk toolbar
src/proxy.ts                404 (not 500) for malformed /papers/... URLs
```
