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
  history_notes: string;
};

export type Job = {
  id: string;
  customer_id: string;
  vehicle_id: string;
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
  const [s] = await sql<Settings[]>`SELECT shop_name, labor_rate_cents, mileage_rate_cents FROM settings WHERE id = 1`;
  return s ?? { shop_name: "FieldWrench", labor_rate_cents: 12500, mileage_rate_cents: 76 };
}

export async function dashboardStats() {
  const sql = await db();
  const today = denverDateISO();
  const jobsToday = await sql`
    SELECT j.*, c.name AS customer_name, v.year AS vehicle_year, v.make, v.model
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    WHERE (j.scheduled_at AT TIME ZONE 'America/Denver')::date = ${today}::date
       OR (j.status IN ('in_progress','waiting_parts') AND (j.scheduled_at AT TIME ZONE 'America/Denver')::date <= ${today}::date)
    ORDER BY j.scheduled_at ASC NULLS LAST
  `;
  const unpaid = await sql`
    SELECT i.*, j.id AS job_id, c.name AS customer_name, v.year AS vehicle_year, v.make, v.model
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
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

export async function listJobs() {
  const sql = await db();
  return sql`
    SELECT j.*, c.name AS customer_name, v.year AS vehicle_year, v.make, v.model, v.plate,
      i.status AS invoice_status, i.token AS invoice_token
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    LEFT JOIN invoices i ON i.job_id = j.id
    ORDER BY
      CASE j.status
        WHEN 'in_progress' THEN 0
        WHEN 'scheduled' THEN 1
        WHEN 'waiting_parts' THEN 2
        ELSE 3
      END,
      j.scheduled_at ASC NULLS LAST
  `;
}

export async function listCustomers() {
  const sql = await db();
  return sql`
    SELECT c.*, COUNT(v.id)::int AS vehicle_count
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
    SELECT j.*, v.year AS vehicle_year, v.make, v.model
    FROM jobs j JOIN vehicles v ON v.id = j.vehicle_id
    WHERE j.customer_id = ${id}
    ORDER BY j.scheduled_at DESC NULLS LAST
  `;
  return { customer: c, vehicles, jobs };
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
  const [customer] = await sql<Customer[]>`SELECT * FROM customers WHERE id = ${job.customer_id}`;
  const [vehicle] = await sql<Vehicle[]>`SELECT * FROM vehicles WHERE id = ${job.vehicle_id}`;
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
  return { job, customer, vehicle, labor, parts, photos, invoice, receipts, receiptCents, profit };
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
    SELECT r.*, c.name AS customer_name
    FROM receipts r
    LEFT JOIN jobs j ON j.id = r.job_id
    LEFT JOIN customers c ON c.id = j.customer_id
    ORDER BY r.date DESC
  `;
}

export async function listMileage() {
  const sql = await db();
  const rows = await sql`
    SELECT m.*, c.name AS customer_name
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
    SELECT j.id, c.name AS customer_name, v.make, v.model, j.status
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    ORDER BY j.created_at DESC
  `;
}
