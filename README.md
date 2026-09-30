# FieldWrench

Mobile-first driveway shop book for a solo mobile mechanic. Jobs, customers, vehicles, invoices, profit after parts, receipts, mileage, VIN decode, DTC lookup, and a public booking page.

**Visual identity:** near-black shop floor, amber steel, huge tap targets. Not a purple dashboard. Not AutoTechLog. Not PitStop.

## Live URL

Repo: https://github.com/IsaacMilligan/fieldwrench

Production host is Vercel. After `npx vercel login` (this machine is not logged in), deploy with:

```bash
npx vercel --prod --yes
```

Set `DATABASE_URL` and `SESSION_SECRET` on the project. Optional: `BLOB_READ_WRITE_TOKEN`, `VEHICLE_FINDER_API_KEY` (Vehicle Finder Free VIN → year/make/model only; NHTSA fallback when unset or on any VF error). Oil specs are shop-owned — no oil API key. Optional: `OPENAI_API_KEY` (or `XAI_API_KEY`) for **Add from O'Reilly screenshot**; `OIL_SPECS_READ_TOKEN` + `OIL_SPECS_READ_SHOP_ID` for external read access to `GET /api/oil/specs`; `OIL_SPEC_BOT_TOKEN` for bot writes via `POST /api/oil/specs`.
Customer login: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public app key only).

Local: `http://localhost:3000`

## Demo login

- Email: `wrench@fieldwrench.local`
- Password: `driveway`
- One-tap **Enter shop** on `/login`

Public (no mechanic login): `/book` and invoice share links at `/i/[token]`

Customer login (Supabase Auth, publishable key only — never a service role key in the app):

- `/customer/login` and `/customer/signup`
- `/customer` — that customer’s booking requests
- `/book` still works logged out

## How to run locally

```bash
npm install
cp env.example .env.local
# set DATABASE_URL to a Postgres URL (Prisma Postgres, Neon, or Vercel Postgres)
# set SESSION_SECRET to a long random string
# optional: BLOB_READ_WRITE_TOKEN for Vercel Blob photo uploads
# optional: VEHICLE_FINDER_API_KEY for Vehicle Finder Free VIN decode (NHTSA fallback without it)
# optional: OPENAI_API_KEY (or XAI_API_KEY) for O'Reilly screenshot → oil spec import
# optional: OIL_SPECS_READ_TOKEN + OIL_SPECS_READ_SHOP_ID for external reads of /api/oil/specs
# optional: OIL_SPEC_BOT_TOKEN for bot writes via POST /api/oil/specs (live shop)
npm run dev
```

Open `http://localhost:3000`. The first request creates tables and seeds demo data if the database is empty.

```bash
npm run build
npm start
```

## Persistent store

Do not use a local JSON file. This app uses Postgres (`DATABASE_URL`) so serverless instances share one shop book. Job photos go to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set; otherwise they are stored as bytes in Postgres and served from `/api/media/[id]`.

## Screen map

| Screen | Route |
| --- | --- |
| Dashboard | `/` |
| Jobs pipeline | `/jobs` |
| Job detail + profit | `/jobs/[id]` |
| Customers | `/customers`, `/customers/[id]` |
| Vehicles | `/vehicles/[id]` |
| VIN + DTC tools | `/tools` |
| Invoice (mechanic) | `/invoices/[id]` |
| Invoice share (public) | `/i/[token]` |
| Receipts | `/more?tab=receipts` (also `/receipts`) |
| Mileage | `/more?tab=mileage` (also `/mileage`) |
| Bookings inbox | `/bookings` |
| Public book | `/book` |
| Customer login | `/customer/login` |
| Customer home | `/customer` |
| Settings | `/more?tab=settings` (also `/settings`) |
| More | `/more` |

Phone nav: **Home · Jobs · Book · Tools · More**

## Profit formula

```
profit = invoiced total - parts cost - linked receipt expenses
```

- Invoiced total = labor (hours × rate or flat) + parts customer price
- Labor is revenue, never a cost
- Parts markup $ = customer price − parts cost
- Parts markup % = markup $ / parts cost

IRS mileage default: **76 cents** (business rate from July 1, 2026). Editable in Settings.

## VIN + DTC

- VIN: server route `POST /api/vin` → Vehicle Finder Free (`VEHICLE_FINDER_API_KEY`) for year/make/model when set; soft-fails to NHTSA vPIC `DecodeVinValues` otherwise. No oil from Vehicle Finder or any other API.
- Oil specs: shop-owned table `oil_defaults` in the shop Postgres DB (`DATABASE_URL`, not Supabase), created/extended by `ensureReady()` in `lib/db/index.ts`. Unique on shop + year + normalized make/model/engine. Columns: `oil_viscosity`, `oil_qt` (capacity w/ filter), `oil_drain_tq` (ft-lb), `socket_size_mm` (optional), `verified`, `created_at`, `updated_at`. **Save oil spec** on a job or vehicle upserts a verified row for that exact Y/M/M/engine; job, vehicle, create-job, and VIN decode auto-fill only from verified rows (exact key, no fallback). Missing/incomplete spec shows a **Look up in O'Reilly Pro** button (opens https://www.oreillypro.com/ — the pro site is login-gated with no public vehicle deep link).
- O'Reilly screenshot import: **Add from O'Reilly screenshots** on the job, vehicle, shop-spec, and create-job / add-vehicle oil cards. O'Reilly Pro shows each spec on its own screen with no vehicle on it, so one import takes up to 6 images (multi-picker or Ctrl/Cmd+V; thumbnail strip with × each, then **Read specs**). `POST /api/oil/extract` (session auth; multipart `image` fields; images only, 8 MB each, decoded with sharp, HEIC converted) sends them in one call to a vision model with a strict JSON schema and a never-guess prompt that reads each screen by its heading (Engine oil viscosity / Engine oil capacity / Oil drain plug torque). The server merges per-image results deterministically: viscosity only from the **All TEMPS** row (none → blank; never a temperature-range row), capacity only when the screen shows **Including Filter: Yes** (No → blank + "Only capacity with filter is saved"), two images disagreeing → blank, blurry/cropped/implausible → blank. Each value comes back with its source image number. **The extract endpoint never writes to the DB.** Year/make/model/engine always come from the job/vehicle record (resolved server-side from `vehicleId`/`specId`; create-job with an unsaved vehicle uses the picker). The confirm card shows the vehicle read-only plus four editable rows (blank = `Not found in screenshots`); only **Save as verified** writes, via `POST /api/oil/import` → the same `upsertVerifiedOilSpec` used by **Save oil spec** (blank fields keep values already on a verified row). Provider: OpenAI `gpt-4.1-mini` when `OPENAI_API_KEY` is set, else xAI when `XAI_API_KEY` is set (`OIL_VISION_PROVIDER` / `OIL_VISION_MODEL` override). No key → "Screenshot import needs OPENAI_API_KEY set"; manual entry unaffected.
- Oil spec read API: `GET /api/oil/specs?year=&make=&model=&engine=` — read-only, verified rows only, via `lookupShopOil` / `getShopOilDefault` (the one lookup also used by job/vehicle/create-job fill, `/api/oil`, Tools VIN decode, and job-template oil billing). Match rule: exact normalized key first (`match: "exact"`); if none and the requested engine starts with a displacement (`3.7L`, `3.7 L V6 gasoline`, `3.7`), the ONE verified row for the same shop/year/make/model with the same displacement to 1 decimal (`match: "displacement"`); zero or 2+ such rows → none. A blank engine only matches a blank-engine row. 200 with the spec, 404 `{"status":"none"}` when nothing verified matches, 400 on missing params. Auth: the app session cookie, or `Authorization: Bearer $OIL_SPECS_READ_TOKEN` scoped to the shop in `OIL_SPECS_READ_SHOP_ID` (`live` or `demo`; token auth is off unless both are set). Call it server-side only — never ship the token to a browser.
- Oil spec bot write: `POST /api/oil/specs` with JSON `{year, make, model, engine, trim, oil_qt, oil_viscosity, oil_drain_tq, socket_size_mm}` and `Authorization: Bearer $OIL_SPEC_BOT_TOKEN` (constant-time check; missing/wrong/unset token → 401; the session cookie is **not** accepted). Writes a **verified** row into the live shop (`shop_id = 'live'`, `LIVE_SHOP_ID` in `lib/shop.ts`) through the same `upsertVerifiedOilSpec` as Save oil spec, so the key normalization is identical and re-posting the same vehicle updates that row (200 `updated`) instead of adding one (201 `created`). year/make/model required; engine optional but part of the key; `oil_qt` 0.5–20, `oil_drain_tq` 5–100, `socket_size_mm` 6–36, viscosity like `5W-30`; null/blank oil fields are saved blank; bad input → 400. `trim` is stored in `oil_defaults.trim` for display but is not part of the unique key.
- DTC: bundled generic OBD-II list (150+ P/B/C/U codes), no paid API

## Stack

Next.js App Router, Postgres, Vercel. Auth is a signed httpOnly cookie.
