# FieldWrench

Mobile-first driveway shop book for a solo mobile mechanic. Jobs, customers, vehicles, invoices, profit after parts, receipts, mileage, VIN decode, DTC lookup, and a public booking page.

**Visual identity:** near-black shop floor, amber steel, huge tap targets. Not a purple dashboard. Not AutoTechLog. Not PitStop.

## Live URL

Repo: https://github.com/IsaacMilligan/fieldwrench

Production host is Vercel. After `npx vercel login` (this machine is not logged in), deploy with:

```bash
npx vercel --prod --yes
```

Set `DATABASE_URL` and `SESSION_SECRET` on the project. Optional: `BLOB_READ_WRITE_TOKEN`.
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

- VIN: server route `POST /api/vin` → live `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`
- DTC: bundled generic OBD-II list (150+ P/B/C/U codes), no paid API

## Stack

Next.js App Router, Postgres, Vercel. Auth is a signed httpOnly cookie.
