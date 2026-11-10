# ✦ Centauri

**Live:** https://centauri-tanamarobys-projects.vercel.app

A personal ticket wallet and trip planner, built as an iPhone-first PWA.

Drop in a boarding pass PDF, a ferry ticket screenshot, or scan a QR code. Centauri reads it on your phone and files it as a clean wallet card with a scannable barcode. Group tickets into trips and see everything on a day-by-day timeline. It syncs to your own Postgres database and works offline at the gate.

## Features

- **Wallet**: Apple Wallet style passes for flights, boats, trains, buses, stays and events. The barcode is re-rendered from its data so it's always crisp, with a full-screen white mode for gate scanners.
- **Smart import** (all parsing happens in the browser):
  - IATA boarding pass barcodes (PDF417 / Aztec / QR) are decoded into airline, flight, route, seat, PNR, passenger and date
  - PDF text extraction (pdf.js) and image OCR (tesseract.js) with heuristics for dates, times, booking refs, ports, seats, gates
  - Live camera scanning of QR / PDF417 / Aztec / Data Matrix / Code 128
  - Everything lands in an editable form before saving
- **Trips and timeline**: group tickets into trips, view a day-by-day itinerary.
- **Sync**: Neon Postgres (via Drizzle) for data, Vercel Blob for original files (private store).
- **Offline**: tickets are cached on the device (React Query + localStorage), and a service worker caches the app shell and ticket files.
- **Private**: single password, signed httpOnly cookie that lasts a year and renews itself, so you log in once per device. Everything (pages and API) is behind the auth proxy.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · vaul · sonner · TanStack Query · Drizzle ORM · Neon · Vercel Blob · jose · ZXing · pdf.js · tesseract.js · bwip-js

## Deploy to Vercel

1. Import this repo in Vercel (framework: Next.js, no build settings needed).
2. **Database**: either add Neon from **Storage** in Vercel (sets `DATABASE_URL`), or use the linked Neon project (`neon.ts`): run `neon deploy`, then copy `DATABASE_URL` from `.env.local` into Vercel. Tables are created automatically on first request.
3. **Storage → Create → Blob**, choose **Private** access, and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | the password you'll use to unlock the app |
   | `AUTH_SECRET` | a random string, 32+ characters (`openssl rand -base64 48`) |
   | `BLOB_ACCESS` | optional, `private` (default) or `public` to match your Blob store |


5. Redeploy. Open the site in Safari on your iPhone, sign in, then **Share → Add to Home Screen**.

> Changing `AUTH_SECRET` signs out every device. Changing `APP_PASSWORD` does not; rotate `AUTH_SECRET` too if you want to revoke existing logins.

## Local development

```bash
npm install
cp .env.example .env.local   # set APP_PASSWORD and AUTH_SECRET
npm run dev
```

`neon deploy` writes `DATABASE_URL` into `.env.local`. Without `DATABASE_URL`, an embedded Postgres (PGlite) is used in `./.pglite`, so it works with zero setup. File uploads need `BLOB_READ_WRITE_TOKEN` (tickets still save without the original file).

Scripts: `npm run typecheck`, `npm run lint`, `npm run icons` (regenerate icons from `public/icons/icon.svg`), `npm run db:push` / `db:studio` (drizzle-kit).

## Project layout

```
src/
  proxy.ts                 auth gate for every page and API route
  app/(app)/               wallet, timeline, trips, add, ticket detail, settings
  app/api/                 tickets, trips, upload token, private file streaming, auth
  lib/parse/               BCBP boarding-pass parser, text heuristics, PDF/image/OCR extraction
  lib/db/                  Drizzle schema + Neon/PGlite client
  components/              wallet cards, barcode, forms, camera scanner, shadcn/ui
public/sw.js               service worker (offline shell + file cache)
```
