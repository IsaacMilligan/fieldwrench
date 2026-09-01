import postgres from "postgres";

const globalForSql = globalThis as unknown as {
  fwSql?: ReturnType<typeof postgres>;
};

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForSql.fwSql) {
    globalForSql.fwSql = postgres(url, {
      ssl: { rejectUnauthorized: false },
      max: 5,
      idle_timeout: 20,
      connect_timeout: 20,
      prepare: false,
      fetch_types: false,
      onnotice: () => {},
      onclose: () => {
        if (globalForSql.fwSql) globalForSql.fwSql = undefined;
      },
    });
  }
  return globalForSql.fwSql;
}

function isConnErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /connection closed|ECONNRESET|timeout|terminat/i.test(msg);
}

export async function resetSql() {
  const old = globalForSql.fwSql;
  globalForSql.fwSql = undefined;
  if (old) {
    try {
      await old.end({ timeout: 1 });
    } catch {
      /* ignore */
    }
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL,
  labor_rate_cents INTEGER NOT NULL,
  mileage_rate_cents INTEGER NOT NULL,
  lead_hours INTEGER NOT NULL DEFAULT 24,
  theme TEXT NOT NULL DEFAULT 'light',
  seeded INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  year INTEGER,
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  plate TEXT NOT NULL DEFAULT '',
  vin TEXT NOT NULL DEFAULT '',
  mileage INTEGER,
  engine TEXT NOT NULL DEFAULT '',
  history_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  status TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  address TEXT NOT NULL DEFAULT '',
  complaint TEXT NOT NULL DEFAULT '',
  diagnosis TEXT NOT NULL DEFAULT '',
  work_performed TEXT NOT NULL DEFAULT '',
  services TEXT NOT NULL DEFAULT '[]',
  service_mileage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS labor_lines (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  rate_cents INTEGER NOT NULL DEFAULT 0,
  is_flat INTEGER NOT NULL DEFAULT 0,
  flat_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS part_lines (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(8,2) NOT NULL DEFAULT 1,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unpaid',
  paid_method TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mileage_trips (
  id TEXT PRIMARY KEY,
  miles NUMERIC(8,1) NOT NULL,
  purpose TEXT NOT NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  vehicle_year INTEGER,
  vehicle_make TEXT NOT NULL DEFAULT '',
  vehicle_model TEXT NOT NULL DEFAULT '',
  vehicle_engine TEXT NOT NULL DEFAULT '',
  issue TEXT NOT NULL,
  services TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  preferred_time TEXT NOT NULL DEFAULT '',
  preferred_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(token);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(customer_email);
`;

let ready: Promise<void> | null = null;

export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const run = async () => {
        const sql = getSql();
        for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
          await sql.unsafe(stmt);
        }
        await sql.unsafe(
          `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT ''`,
        );
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS services TEXT NOT NULL DEFAULT '[]'`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS services TEXT NOT NULL DEFAULT '[]'`);
        await sql.unsafe(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_mileage INTEGER`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_year INTEGER`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_make TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_model TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_engine TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS lead_hours INTEGER NOT NULL DEFAULT 24`);
        await sql.unsafe(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'`);
        await sql.unsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_date DATE`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS oil_qt NUMERIC`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS oil_viscosity TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS oil_qt_without NUMERIC`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS oil_viscosity_alt TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS oil_saved INTEGER NOT NULL DEFAULT 0`);
        await sql.unsafe(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''`);
        await sql.unsafe(`
          UPDATE jobs SET services = '["battery_test"]', service_mileage = COALESCE(service_mileage, 164000)
          WHERE work_performed LIKE 'Installed Group 35 AGM%' AND (services = '[]' OR services = '' OR services IS NULL)
        `);
        await sql.unsafe(`
          UPDATE jobs SET services = '["oil_change","cabin_filter"]', service_mileage = COALESCE(service_mileage, 86800)
          WHERE work_performed LIKE 'Oil, filter, cabin filter%' AND (services = '[]' OR services = '' OR services IS NULL)
        `);
        await sql.unsafe(`
          UPDATE jobs SET services = '["brake_job"]', service_mileage = COALESCE(service_mileage, 118050)
          WHERE work_performed LIKE 'Rear pads and hardware%' AND (services = '[]' OR services = '' OR services IS NULL)
        `);
        const { seedIfEmpty } = await import("./seed");
        await seedIfEmpty(sql);
      };
      try {
        await run();
      } catch (e) {
        if (!isConnErr(e)) throw e;
        await resetSql();
        await run();
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export type Sql = ReturnType<typeof getSql>;
