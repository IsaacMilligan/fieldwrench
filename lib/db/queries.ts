import { ensureReady, getSql, resetSql } from "./index";
import {
  computeProfit,
  laborLineCents,
  partCostCents,
  partCustomerCents,
} from "../profit";
import { denverDateISO } from "../format";
import type { JobStatus, PayMethod } from "../status";

export async function db() {
  await ensureReady();
  try {
    const sql = getSql();
    await sql`select 1 as n`;
    return sql;
  } catch (e) {
    if (!isConnErr(e)) throw e;
    await resetSql();
    await ensureReady();
    return getSql();
  }
}

function isConnErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /connection closed|ECONNRESET|timeout|terminat/i.test(msg);
}

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export type Vehicle = {
  id: string;
  customer_id: string;
  year: number | null;
  make: string;
  model: string;
  plate: string;
  vin: string;
  mileage: number | null;
  engine: string;
  history_notes: string;
  oil_qt: number | null;
  oil_viscosity: string;
  oil_qt_without: number | null;
  oil_viscosity_alt: string;
  oil_saved: boolean;
};

export type Job = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  customer_name?: string;
  vehicle_year?: number | null;
  vehicle_make?: string;
  vehicle_model?: string;
  status: JobStatus;
  scheduled_at: string | null;
  address: string;
  complaint: string;
  diagnosis: string;
  work_performed: string;
};

export type LaborLine = {
  id: string;
  job_id: string;
  description: string;
  hours: number;
  rate_cents: number;
  is_flat: boolean;
  flat_cents: number;
};

export type PartLine = {
  id: string;
  job_id: string;
  description: string;
  qty: number;
  cost_cents: number;
  price_cents: number;
};

export type Invoice = {
  id: string;
  job_id: string;
  token: string;
  status: "paid" | "unpaid";
  paid_method: PayMethod | null;
  paid_at: string | null;
  created_at?: string;
};

export type Settings = {
  shop_name: string;
  labor_rate_cents: number;
  mileage_rate_cents: number;
  lead_hours: number;
  theme: "light" | "dark";
};

function mapLabor(r: Record<string, unknown>): LaborLine {
  return {
    id: String(r.id),
    job_id: String(r.job_id),
    description: String(r.description),
    hours: Number(r.hours),
    rate_cents: Number(r.rate_cents),
    is_flat: Boolean(Number(r.is_flat)),
    flat_cents: Number(r.flat_cents),
  };
}

function mapPart(r: Record<string, unknown>): PartLine {
  return {
    id: String(r.id),
    job_id: String(r.job_id),
    description: String(r.description),
    qty: Number(r.qty),
    cost_cents: Number(r.cost_cents),
    price_cents: Number(r.price_cents),
  };
}

export function profitFor(lines: {
  labor: LaborLine[];
  parts: PartLine[];
  receiptCents: number;
}) {
  const laborCents = lines.labor.reduce((s, l) => s + laborLineCents({
    isFlat: l.is_flat,
    flatCents: l.flat_cents,
    hours: l.hours,
    rateCents: l.rate_cents,
  }), 0);
  const partsCustomerCents = lines.parts.reduce((s, p) => s + partCustomerCents(p), 0);
  const partsCostCents = lines.parts.reduce((s, p) => s + partCostCents({
    qty: p.qty,
    costCents: p.cost_cents,
  }), 0);
  return computeProfit({
    laborCents,
    partsCustomerCents,
    partsCostCents,
    receiptCents: lines.receiptCents,
  });
}

export async function getSettings(): Promise<Settings> {
  const sql = await db();
  const [s] = await sql<Settings[]>`SELECT shop_name, labor_rate_cents, mileage_rate_cents, lead_hours, theme FROM settings WHERE id = 1`;
  const theme = s?.theme === "dark" ? "dark" : "light";
  return s
    ? { ...s, theme }
    : { shop_name: "FieldWrench", labor_rate_cents: 12500, mileage_rate_cents: 76, lead_hours: 24, theme: "light" };
}

export async function getShopTheme(): Promise<"light" | "dark"> {
  try {
    const s = await getSettings();
    return s.theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export async function dashboardStats() {
  const sql = await db();
  const today = denverDateISO();
  const jobsToday = await sql`
    SELECT j.*, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
       OR (j.status IN ('in_progress','waiting_parts') AND (j.scheduled_at AT TIME ZONE 'America/Denver')::date <= ${today}::date)
    ORDER BY j.scheduled_at ASC NULLS LAST
  `;
  const unpaid = await sql`
    SELECT i.*, j.id AS job_id, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE i.status = 'unpaid'
    ORDER BY i.created_at DESC
  `;
  const year = today.slice(0, 4);
  const trips = await sql<{ miles: string }[]>`
    SELECT miles::text FROM mileage_trips WHERE date >= ${year + "-01-01"}::date
  `;
  const ytdMiles = trips.reduce((s, t) => s + Number(t.miles), 0);

  const weekStart = await sql<{ d: string }[]>`
    SELECT (${today}::date - EXTRACT(DOW FROM ${today}::date)::int)::text AS d
  `;
  const ws = weekStart[0]?.d ?? today;

  const [weekRow] = await sql<{ profit: number }[]>`
    SELECT COALESCE((
      SELECT SUM(
        CASE WHEN l.is_flat = 1 THEN l.flat_cents ELSE ROUND(l.hours * l.rate_cents) END
      ) FROM labor_lines l
      JOIN jobs j ON j.id = l.job_id
      WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date BETWEEN ${ws}::date AND ${today}::date
    ), 0)
    + COALESCE((
      SELECT SUM(p.qty * p.price_cents) FROM part_lines p
      JOIN jobs j ON j.id = p.job_id
      WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date BETWEEN ${ws}::date AND ${today}::date
    ), 0)
    - COALESCE((
      SELECT SUM(p.qty * p.cost_cents) FROM part_lines p
      JOIN jobs j ON j.id = p.job_id
      WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date BETWEEN ${ws}::date AND ${today}::date
    ), 0)
    - COALESCE((
      SELECT SUM(r.amount_cents) FROM receipts r
      JOIN jobs j ON j.id = r.job_id
      WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date BETWEEN ${ws}::date AND ${today}::date
    ), 0)
    AS profit
  `;
  const weekProfit = Number(weekRow?.profit ?? 0);

  const unpaidTotals = await sql<{ job_id: string; total: number }[]>`
    SELECT j.id AS job_id,
      COALESCE((
        SELECT SUM(CASE WHEN l.is_flat = 1 THEN l.flat_cents ELSE ROUND(l.hours * l.rate_cents) END)
        FROM labor_lines l WHERE l.job_id = j.id
      ), 0)
      + COALESCE((SELECT SUM(p.qty * p.price_cents) FROM part_lines p WHERE p.job_id = j.id), 0)
      AS total
    FROM jobs j
  `;
  const totalByJob = Object.fromEntries(unpaidTotals.map((r) => [String(r.job_id), Number(r.total)]));

  const unpaidWithTotals: Array<{
    id: string;
    job_id: string;
    customer_name: string;
    vehicle_year: number | null;
    make: string;
    model: string;
    total: number;
  }> = unpaid.map((row) => ({
    id: String(row.id),
    job_id: String(row.job_id),
    customer_name: String(row.customer_name),
    vehicle_year: (row.vehicle_year as number | null) ?? null,
    make: String(row.make),
    model: String(row.model),
    total: totalByJob[String(row.job_id)] ?? 0,
  }));

  return { jobsToday, unpaid: unpaidWithTotals, ytdMiles, weekProfit, today };
}

export type HomeNext =
  | {
      kind: "job";
      id: string;
      href: string;
      customer: string;
      vehicleYear: number | null;
      make: string;
      model: string;
      services: string;
      scheduledAt: string | null;
      status: string;
    }
  | {
      kind: "booking";
      id: string;
      href: string;
      customer: string;
      vehicleYear: number | null;
      make: string;
      model: string;
      services: string;
      scheduledAt: null;
      preferredDate: string | null;
      status: string;
    };

export async function homeDashboard() {
  const sql = await db();
  const today = denverDateISO();

  const [counts] = await sql<{ jobs: number; bookings: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM jobs j
        WHERE j.status NOT IN ('cancelled','completed')
          AND (
            j.status IN ('in_progress','waiting_parts')
            OR (
              j.scheduled_at IS NOT NULL
              AND (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
            )
          )) AS jobs,
      (SELECT COUNT(*)::int FROM bookings b
        WHERE b.status = 'pending' AND b.preferred_date = ${today}::date) AS bookings
  `;
  const todayCount = Number(counts?.jobs ?? 0) + Number(counts?.bookings ?? 0);

  const nextJobs = await sql<
    {
      id: string;
      status: string;
      scheduled_at: Date | string | null;
      services: string;
      customer_name: string;
      vehicle_year: number | null;
      make: string;
      model: string;
    }[]
  >`
    SELECT j.id, j.status, j.scheduled_at, j.services,
      COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE j.status = 'scheduled'
      AND j.scheduled_at IS NOT NULL
      AND j.scheduled_at >= now()
    ORDER BY j.scheduled_at ASC
    LIMIT 1
  `;

  let next: HomeNext | null = null;
  const nj = nextJobs[0];
  if (nj) {
    next = {
      kind: "job",
      id: String(nj.id),
      href: `/jobs/${nj.id}`,
      customer: String(nj.customer_name),
      vehicleYear: nj.vehicle_year,
      make: String(nj.make ?? ""),
      model: String(nj.model ?? ""),
      services: String(nj.services ?? ""),
      scheduledAt: nj.scheduled_at ? new Date(nj.scheduled_at as string | Date).toISOString() : null,
      status: String(nj.status),
    };
  } else {
    const nextBook = await sql<
      {
        id: string;
        name: string;
        vehicle_year: number | null;
        vehicle_make: string;
        vehicle_model: string;
        vehicle: string;
        services: string;
        preferred_date: Date | string | null;
        status: string;
      }[]
    >`
      SELECT id, name, vehicle_year, vehicle_make, vehicle_model, vehicle, services, preferred_date, status
      FROM bookings
      WHERE status = 'pending'
        AND preferred_date IS NOT NULL
        AND preferred_date >= ${today}::date
      ORDER BY preferred_date ASC
      LIMIT 1
    `;
    const nb = nextBook[0];
    if (nb) {
      next = {
        kind: "booking",
        id: String(nb.id),
        href: "/bookings",
        customer: String(nb.name),
        vehicleYear: nb.vehicle_year,
        make: String(nb.vehicle_make || ""),
        model: String(nb.vehicle_model || nb.vehicle || ""),
        services: String(nb.services ?? ""),
        scheduledAt: null,
        preferredDate: nb.preferred_date ? String(nb.preferred_date) : null,
        status: String(nb.status),
      };
    }
  }

  const [moneyRow] = await sql<{ revenue: number; profit: number }[]>`
    SELECT
      COALESCE((
        SELECT SUM(CASE WHEN l.is_flat = 1 THEN l.flat_cents ELSE ROUND(l.hours * l.rate_cents) END)
        FROM labor_lines l JOIN jobs j ON j.id = l.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      + COALESCE((
        SELECT SUM(p.qty * p.price_cents)
        FROM part_lines p JOIN jobs j ON j.id = p.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      AS revenue,
      COALESCE((
        SELECT SUM(CASE WHEN l.is_flat = 1 THEN l.flat_cents ELSE ROUND(l.hours * l.rate_cents) END)
        FROM labor_lines l JOIN jobs j ON j.id = l.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      + COALESCE((
        SELECT SUM(p.qty * p.price_cents)
        FROM part_lines p JOIN jobs j ON j.id = p.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      - COALESCE((
        SELECT SUM(p.qty * p.cost_cents)
        FROM part_lines p JOIN jobs j ON j.id = p.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      - COALESCE((
        SELECT SUM(r.amount_cents)
        FROM receipts r JOIN jobs j ON j.id = r.job_id
        WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
      ), 0)
      AS profit
  `;

  const unpaid = await sql<
    {
      id: string;
      job_id: string;
      customer_name: string;
      vehicle_year: number | null;
      make: string;
      model: string;
    }[]
  >`
    SELECT i.id, j.id AS job_id, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE i.status = 'unpaid'
    ORDER BY i.created_at DESC
    LIMIT 8
  `;
  const unpaidTotals = await sql<{ job_id: string; total: number }[]>`
    SELECT j.id AS job_id,
      COALESCE((
        SELECT SUM(CASE WHEN l.is_flat = 1 THEN l.flat_cents ELSE ROUND(l.hours * l.rate_cents) END)
        FROM labor_lines l WHERE l.job_id = j.id
      ), 0)
      + COALESCE((SELECT SUM(p.qty * p.price_cents) FROM part_lines p WHERE p.job_id = j.id), 0)
      AS total
    FROM jobs j
  `;
  const totalByJob = Object.fromEntries(unpaidTotals.map((r) => [String(r.job_id), Number(r.total)]));
  const unpaidRows = unpaid.map((row) => ({
    id: String(row.id),
    job_id: String(row.job_id),
    customer_name: String(row.customer_name),
    vehicle_year: row.vehicle_year,
    make: String(row.make),
    model: String(row.model),
    total: totalByJob[String(row.job_id)] ?? 0,
  }));
  const unpaidCents = unpaidRows.reduce((s, r) => s + r.total, 0);
  const [pendingRow] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'pending'
  `;

  return {
    today,
    todayCount,
    next,
    todayRevenue: Number(moneyRow?.revenue ?? 0),
    todayProfit: Number(moneyRow?.profit ?? 0),
    unpaid: unpaidRows,
    unpaidCents,
    pendingBookings: Number(pendingRow?.n ?? 0),
  };
}

export async function listJobs() {
  const sql = await db();
  return sql`
    SELECT j.*, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model, v.plate,
      i.status AS invoice_status, i.token AS invoice_token
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    LEFT JOIN invoices i ON i.job_id = j.id
    ORDER BY
      CASE j.status
        WHEN 'in_progress' THEN 0
        WHEN 'scheduled' THEN 1
        WHEN 'waiting_parts' THEN 2
        WHEN 'completed' THEN 3
        WHEN 'cancelled' THEN 4
        ELSE 5
      END,
      j.scheduled_at ASC NULLS LAST
  `;
}

export async function listCustomers() {
  const sql = await db();
  return sql`
    SELECT c.*, COUNT(v.id)::int AS vehicle_count,
      (SELECT MAX(j.scheduled_at) FROM jobs j WHERE j.customer_id = c.id) AS last_visit
    FROM customers c
    LEFT JOIN vehicles v ON v.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `;
}

export async function getCustomer(id: string) {
  const sql = await db();
  const [c] = await sql<Customer[]>`SELECT * FROM customers WHERE id = ${id}`;
  if (!c) return null;
  const vehicles = await sql<Vehicle[]>`SELECT * FROM vehicles WHERE customer_id = ${id} ORDER BY year DESC`;
  const jobs = await sql`
    SELECT j.*, COALESCE(v.year, j.vehicle_year) AS vehicle_year, COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make, COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model
    FROM jobs j LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE j.customer_id = ${id}
    ORDER BY j.scheduled_at DESC NULLS LAST
  `;
  const [unpaid] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id
    WHERE j.customer_id = ${id} AND i.status = 'unpaid'
  `;
  return { customer: c, vehicles, jobs, unpaidInvoices: Number(unpaid?.n ?? 0) };
}

export async function getVehicle(id: string) {
  const sql = await db();
  const [v] = await sql<Vehicle[]>`SELECT * FROM vehicles WHERE id = ${id}`;
  if (!v) return null;
  const [c] = await sql<Customer[]>`SELECT * FROM customers WHERE id = ${v.customer_id}`;
  const jobs = await sql`SELECT * FROM jobs WHERE vehicle_id = ${id} ORDER BY scheduled_at DESC NULLS LAST`;
  return { vehicle: v, customer: c, jobs };
}

export async function getJobBundle(jobId: string) {
  const sql = await db();
  const [job] = await sql<Job[]>`SELECT * FROM jobs WHERE id = ${jobId}`;
  if (!job) return null;
  const [customer] = job.customer_id
    ? await sql<Customer[]>`SELECT * FROM customers WHERE id = ${job.customer_id}`
    : [];
  const [vehicle] = job.vehicle_id
    ? await sql<Vehicle[]>`SELECT * FROM vehicles WHERE id = ${job.vehicle_id}`
    : [];
  const displayCustomer: Customer = customer ?? {
    id: "",
    name: String(job.customer_name || "Deleted customer"),
    phone: "",
    email: "",
    address: "",
    notes: "",
  };
  const displayVehicle: Vehicle | null = vehicle
    ? vehicle
    : job.vehicle_make || job.vehicle_model || job.vehicle_year
      ? {
          id: "",
          customer_id: "",
          year: job.vehicle_year ?? null,
          make: String(job.vehicle_make ?? ""),
          model: String(job.vehicle_model ?? ""),
          plate: "",
          vin: "",
          mileage: null,
          engine: "",
          history_notes: "",
          oil_qt: null,
          oil_viscosity: "",
          oil_qt_without: null,
          oil_viscosity_alt: "",
          oil_saved: false,
        }
      : null;
  const laborRaw = await sql`SELECT * FROM labor_lines WHERE job_id = ${jobId}`;
  const partRaw = await sql`SELECT * FROM part_lines WHERE job_id = ${jobId}`;
  const labor = laborRaw.map(mapLabor);
  const parts = partRaw.map(mapPart);
  const photos = await sql<{ id: string; url: string; content_type: string }[]>`
    SELECT id, url, content_type FROM photos WHERE job_id = ${jobId} ORDER BY created_at
  `;
  const [invoice] = await sql<Invoice[]>`SELECT * FROM invoices WHERE job_id = ${jobId}`;
  const recs = await sql<{ amount_cents: number }[]>`SELECT amount_cents FROM receipts WHERE job_id = ${jobId}`;
  const receiptCents = recs.reduce((s, r) => s + Number(r.amount_cents), 0);
  const receipts = await sql`
    SELECT * FROM receipts WHERE job_id = ${jobId} ORDER BY date DESC
  `;
  const profit = profitFor({ labor, parts, receiptCents });
  return { job, customer: displayCustomer, vehicle: displayVehicle, labor, parts, photos, invoice, receipts, receiptCents, profit };
}

export async function ensureInvoice(jobId: string): Promise<Invoice> {
  const sql = await db();
  const [existing] = await sql<Invoice[]>`SELECT * FROM invoices WHERE job_id = ${jobId}`;
  if (existing) return existing;
  const inv: Invoice = {
    id: crypto.randomUUID(),
    job_id: jobId,
    token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8),
    status: "unpaid",
    paid_method: null,
    paid_at: null,
  };
  await sql`INSERT INTO invoices (id, job_id, token, status) VALUES (${inv.id}, ${inv.job_id}, ${inv.token}, 'unpaid')`;
  return inv;
}

export async function getInvoiceByToken(token: string) {
  const sql = await db();
  const [inv] = await sql<Invoice[]>`SELECT * FROM invoices WHERE token = ${token}`;
  if (!inv) return null;
  const bundle = await getJobBundle(inv.job_id);
  const settings = await getSettings();
  return { invoice: inv, bundle, settings };
}

export async function listReceipts() {
  const sql = await db();
  return sql`
    SELECT r.*, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name
    FROM receipts r
    LEFT JOIN jobs j ON j.id = r.job_id
    LEFT JOIN customers c ON c.id = j.customer_id
    ORDER BY r.date DESC
  `;
}

export async function listMileage() {
  const sql = await db();
  const rows = await sql`
    SELECT m.*, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name
    FROM mileage_trips m
    LEFT JOIN jobs j ON j.id = m.job_id
    LEFT JOIN customers c ON c.id = j.customer_id
    ORDER BY m.date DESC
  `;
  const today = denverDateISO();
  const year = today.slice(0, 4);
  const [sum] = await sql<{ n: number }[]>`
    SELECT COALESCE(SUM(miles), 0)::float AS n FROM mileage_trips WHERE date >= ${year + "-01-01"}::date
  `;
  const ytd = Number(sum?.n ?? 0);
  return { rows, ytd };
}

export async function listCalendarMonth(year: number, month: number) {
  const sql = await db();
  const y = Number.isFinite(year) ? year : new Date().getFullYear();
  const m = Math.min(12, Math.max(1, Math.round(month) || 1));
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
  const jobs = await sql<
    {
      id: string;
      day: string;
      customer_name: string;
      year: number | null;
      make: string;
      model: string;
      engine: string;
      services: string;
      status: string;
    }[]
  >`
    SELECT j.id,
      to_char((j.scheduled_at AT TIME ZONE 'America/Denver')::date, 'YYYY-MM-DD') AS day,
      COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name,
      COALESCE(v.year, j.vehicle_year) AS year,
      COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make,
      COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model,
      v.engine, j.services, j.status
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE j.scheduled_at IS NOT NULL
      AND j.status <> 'cancelled'
      AND (j.scheduled_at AT TIME ZONE 'America/Denver')::date >= ${start}::date
      AND (j.scheduled_at AT TIME ZONE 'America/Denver')::date < ${end}::date
    ORDER BY j.scheduled_at
  `;
  const bookings = await sql<
    {
      id: string;
      day: string;
      name: string;
      vehicle: string;
      vehicle_year: number | null;
      vehicle_make: string;
      vehicle_model: string;
      vehicle_engine: string;
      services: string;
    }[]
  >`
    SELECT id,
      to_char(preferred_date, 'YYYY-MM-DD') AS day,
      name, vehicle, vehicle_year, vehicle_make, vehicle_model, vehicle_engine, services
    FROM bookings
    WHERE preferred_date IS NOT NULL
      AND preferred_date >= ${start}::date
      AND preferred_date < ${end}::date
    ORDER BY preferred_date
  `;
  return { jobs, bookings };
}

export async function listBookings() {
  const sql = await db();
  return sql`SELECT * FROM bookings ORDER BY
    CASE status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
    created_at DESC`;
}

export async function listBookingsByEmail(email: string) {
  const sql = await db();
  const e = email.toLowerCase();
  return sql`SELECT * FROM bookings WHERE lower(customer_email) = ${e} ORDER BY created_at DESC`;
}

export async function listCustomerGarage(email: string) {
  const sql = await db();
  const e = email.toLowerCase();
  const customers = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM customers WHERE lower(email) = ${e}
  `;
  if (!customers.length) {
    return { vehicles: [] as Array<{
      id: string;
      year: number | null;
      make: string;
      model: string;
      mileage: number | null;
      jobs: Array<{
        id: string;
        status: string;
        scheduled_at: unknown;
        created_at: unknown;
        services: unknown;
        service_mileage: number | null;
        complaint: string;
        work_performed: string;
        diagnosis: string;
      }>;
    }> };
  }
  const ids = customers.map((c) => c.id);
  const vehicles = await sql<{
    id: string;
    year: number | null;
    make: string;
    model: string;
    mileage: number | null;
  }[]>`
    SELECT id, year, make, model, mileage FROM vehicles
    WHERE customer_id IN ${sql(ids)}
    ORDER BY year DESC NULLS LAST, make
  `;
  const jobs = await sql<{
    id: string;
    vehicle_id: string;
    status: string;
    scheduled_at: unknown;
    created_at: unknown;
    services: unknown;
    service_mileage: number | null;
    complaint: string;
    work_performed: string;
    diagnosis: string;
  }[]>`
    SELECT id, vehicle_id, status, scheduled_at, created_at, services, service_mileage,
           complaint, work_performed, diagnosis
    FROM jobs
    WHERE customer_id IN ${sql(ids)} AND status = 'completed'
    ORDER BY COALESCE(scheduled_at, created_at) DESC
  `;
  return {
    vehicles: vehicles.map((v) => ({
      ...v,
      jobs: jobs.filter((j) => j.vehicle_id === v.id),
    })),
  };
}

export async function listJobsLite() {
  const sql = await db();
  return sql`
    SELECT j.id, COALESCE(NULLIF(c.name, ''), NULLIF(j.customer_name, ''), 'Deleted customer') AS customer_name,
      COALESCE(NULLIF(v.make, ''), j.vehicle_make) AS make,
      COALESCE(NULLIF(v.model, ''), j.vehicle_model) AS model, j.status
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    ORDER BY j.created_at DESC
  `;
}
