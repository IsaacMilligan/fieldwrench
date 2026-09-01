"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { DEMO, clearSession, createSession, requireSession, verifyLogin } from "./auth";
import { getCustomerUser } from "./supabase/server";
import { db, ensureInvoice } from "./db/queries";
import { seedDemo } from "./db/seed";
import { getSql } from "./db/index";
import { parseMoney, parseNumber, vinOk } from "./format";
import type { JobStatus, PayMethod } from "./status";
import { JOB_STATUSES, PAY_METHODS } from "./status";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function loginAction(_prev: { error?: string } | null, form: FormData) {
  try {
    await import("./db/index").then((m) => m.ensureReady());
    const email = str(form, "email").toLowerCase();
    const password = str(form, "password");
    const ok = await verifyLogin(email, password);
    if (!ok) return { error: "Wrong email or password." };
    await createSession(email);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed.";
    return { error: msg.includes("DATABASE_URL") ? "Shop database is not configured." : "Login failed. Try again." };
  }
  redirect("/");
}

export async function demoLoginAction() {
  try {
    await import("./db/index").then((m) => m.ensureReady());
    const ok = await verifyLogin(DEMO.email, DEMO.password);
    if (!ok) return;
    await createSession(DEMO.email);
  } catch {
    return;
  }
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function saveSettingsAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const shop = str(form, "shop_name") || "FieldWrench";
  const labor = parseMoney(str(form, "labor_rate"));
  const miles = Math.round(parseNumber(str(form, "mileage_rate")) * 100) / 100;
  const mileageCents = Math.round(miles);
  await sql`UPDATE settings SET shop_name = ${shop}, labor_rate_cents = ${labor}, mileage_rate_cents = ${mileageCents} WHERE id = 1`;
  revalidatePath("/");
  redirect("/more?tab=settings");
}

export async function resetDemoAction() {
  await requireSession();
  const sql = getSql();
  await seedDemo(sql);
  revalidatePath("/");
  redirect("/");
}

export async function createCustomerAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  await sql`INSERT INTO customers (id, name, phone, email, address, notes) VALUES (
    ${id}, ${str(form, "name") || "Customer"}, ${str(form, "phone")}, ${str(form, "email")},
    ${str(form, "address")}, ${str(form, "notes")}
  )`;
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function updateCustomerAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  await sql`UPDATE customers SET
    name = ${str(form, "name")},
    phone = ${str(form, "phone")},
    email = ${str(form, "email")},
    address = ${str(form, "address")},
    notes = ${str(form, "notes")}
    WHERE id = ${id}`;
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function createVehicleAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  const customerId = str(form, "customer_id");
  const year = parseNumber(str(form, "year")) || null;
  const mileage = parseNumber(str(form, "mileage")) || null;
  await sql`INSERT INTO vehicles (id, customer_id, year, make, model, plate, vin, mileage, history_notes) VALUES (
    ${id}, ${customerId}, ${year}, ${str(form, "make")}, ${str(form, "model")},
    ${str(form, "plate")}, ${str(form, "vin").toUpperCase()}, ${mileage}, ${str(form, "history_notes")}
  )`;
  revalidatePath(`/customers/${customerId}`);
  redirect(`/vehicles/${id}`);
}

export async function updateVehicleAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const year = parseNumber(str(form, "year")) || null;
  const mileage = parseNumber(str(form, "mileage")) || null;
  await sql`UPDATE vehicles SET
    year = ${year},
    make = ${str(form, "make")},
    model = ${str(form, "model")},
    plate = ${str(form, "plate")},
    vin = ${str(form, "vin").toUpperCase()},
    mileage = ${mileage},
    history_notes = ${str(form, "history_notes")}
    WHERE id = ${id}`;
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function applyVinAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "vehicle_id");
  const year = parseNumber(str(form, "year")) || null;
  await sql`UPDATE vehicles SET
    year = ${year},
    make = ${str(form, "make")},
    model = ${str(form, "model")},
    vin = ${str(form, "vin").toUpperCase()}
    WHERE id = ${id}`;
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function createJobAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  const vehicleId = str(form, "vehicle_id");
  const [veh] = await sql<{ customer_id: string }[]>`SELECT customer_id FROM vehicles WHERE id = ${vehicleId}`;
  if (!veh) redirect("/jobs/new");
  const status = (JOB_STATUSES.includes(str(form, "status") as JobStatus)
    ? str(form, "status")
    : "scheduled") as JobStatus;
  const when = str(form, "scheduled_at");
  const scheduled = when ? new Date(when).toISOString() : null;
  await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, scheduled_at, address, complaint, diagnosis, work_performed)
    VALUES (${id}, ${veh.customer_id}, ${vehicleId}, ${status}, ${scheduled}, ${str(form, "address")},
      ${str(form, "complaint")}, ${str(form, "diagnosis")}, ${str(form, "work_performed")})`;
  revalidatePath("/jobs");
  redirect(`/jobs/${id}`);
}

export async function updateJobAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const status = str(form, "status") as JobStatus;
  const when = str(form, "scheduled_at");
  const scheduled = when ? new Date(when).toISOString() : null;
  await sql`UPDATE jobs SET
    status = ${status},
    scheduled_at = ${scheduled},
    address = ${str(form, "address")},
    complaint = ${str(form, "complaint")},
    diagnosis = ${str(form, "diagnosis")},
    work_performed = ${str(form, "work_performed")},
    updated_at = NOW()
    WHERE id = ${id}`;
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}`);
}

export async function setJobStatusAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const status = str(form, "status") as JobStatus;
  if (!JOB_STATUSES.includes(status)) return;
  await sql`UPDATE jobs SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function addLaborAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const isFlat = str(form, "mode") === "flat";
  const settings = (await sql<{ labor_rate_cents: number }[]>`SELECT labor_rate_cents FROM settings WHERE id = 1`)[0];
  const rate = parseMoney(str(form, "rate")) || settings?.labor_rate_cents || 12500;
  await sql`INSERT INTO labor_lines (id, job_id, description, hours, rate_cents, is_flat, flat_cents) VALUES (
    ${crypto.randomUUID()}, ${jobId}, ${str(form, "description") || "Labor"},
    ${parseNumber(str(form, "hours"))}, ${rate}, ${isFlat ? 1 : 0}, ${parseMoney(str(form, "flat"))}
  )`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteLaborAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const jobId = str(form, "job_id");
  await sql`DELETE FROM labor_lines WHERE id = ${id}`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function addPartAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
    ${crypto.randomUUID()}, ${jobId}, ${str(form, "description") || "Part"},
    ${parseNumber(str(form, "qty")) || 1}, ${parseMoney(str(form, "cost"))}, ${parseMoney(str(form, "price"))}
  )`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePartAction(form: FormData) {
  await requireSession();
  const sql = await db();
  await sql`DELETE FROM part_lines WHERE id = ${str(form, "id")}`;
  revalidatePath(`/jobs/${str(form, "job_id")}`);
}

export async function uploadPhotoAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const photoId = crypto.randomUUID();
  const type = file.type || "image/jpeg";
  const buf = Buffer.from(await file.arrayBuffer());
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let url = "";
  let bytes: Buffer | null = buf;
  if (token) {
    const blob = await put(`jobs/${jobId}/${photoId}`, buf, {
      access: "public",
      contentType: type,
      token,
    });
    url = blob.url;
    bytes = null;
  }
  await sql`INSERT INTO photos (id, job_id, url, content_type, bytes) VALUES (
    ${photoId}, ${jobId}, ${url}, ${type}, ${bytes}
  )`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function markInvoicePaidAction(form: FormData) {
  await requireSession();
  const jobId = str(form, "job_id");
  const method = str(form, "method") as PayMethod;
  if (!PAY_METHODS.includes(method)) return;
  const inv = await ensureInvoice(jobId);
  const sql = await db();
  await sql`UPDATE invoices SET status = 'paid', paid_method = ${method}, paid_at = NOW() WHERE id = ${inv.id}`;
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/invoices/${jobId}`);
}

export async function markInvoiceUnpaidAction(form: FormData) {
  await requireSession();
  const jobId = str(form, "job_id");
  const inv = await ensureInvoice(jobId);
  const sql = await db();
  await sql`UPDATE invoices SET status = 'unpaid', paid_method = NULL, paid_at = NULL WHERE id = ${inv.id}`;
  revalidatePath(`/invoices/${jobId}`);
}

export async function openInvoiceAction(form: FormData) {
  await requireSession();
  const jobId = str(form, "job_id");
  await ensureInvoice(jobId);
  redirect(`/invoices/${jobId}`);
}

export async function addReceiptAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id") || null;
  await sql`INSERT INTO receipts (id, amount_cents, vendor, category, date, job_id) VALUES (
    ${crypto.randomUUID()}, ${parseMoney(str(form, "amount"))}, ${str(form, "vendor") || "Vendor"},
    ${str(form, "category") || "parts"}, ${str(form, "date")}, ${jobId}
  )`;
  revalidatePath("/more");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  redirect("/more?tab=receipts");
}

export async function addMileageAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id") || null;
  await sql`INSERT INTO mileage_trips (id, miles, purpose, job_id, date) VALUES (
    ${crypto.randomUUID()}, ${parseNumber(str(form, "miles"))}, ${str(form, "purpose") || "Shop miles"},
    ${jobId}, ${str(form, "date")}
  )`;
  revalidatePath("/more");
  redirect("/more?tab=mileage");
}

export async function publicBookAction(_prev: { ok?: boolean; error?: string } | null, form: FormData) {
  try {
    await import("./db/index").then((m) => m.ensureReady());
    const sql = await db();
    const name = str(form, "name");
    const phone = str(form, "phone");
    const issue = str(form, "issue");
    if (!name || !phone || !issue) return { error: "Name, phone, and issue are required." };
    const user = await getCustomerUser();
    const email = (user?.email ?? str(form, "email")).toLowerCase();
    await sql`INSERT INTO bookings (id, name, phone, address, vehicle, issue, preferred_time, status, customer_email) VALUES (
      ${crypto.randomUUID()}, ${name}, ${phone}, ${str(form, "address")}, ${str(form, "vehicle")},
      ${issue}, ${str(form, "preferred_time")}, 'pending', ${email}
    )`;
    return { ok: true };
  } catch {
    return { error: "Could not save the request. Try again." };
  }
}

export async function dismissBookingAction(form: FormData) {
  await requireSession();
  const sql = await db();
  await sql`UPDATE bookings SET status = 'dismissed' WHERE id = ${str(form, "id")}`;
  revalidatePath("/bookings");
}

export async function acceptBookingAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const bid = str(form, "id");
  const [b] = await sql<{
    name: string; phone: string; address: string; vehicle: string; issue: string;
    preferred_time: string; status: string; services: string; notes: string; customer_email: string;
    vehicle_year: number | null; vehicle_make: string; vehicle_model: string; vehicle_engine: string;
  }[]>`SELECT * FROM bookings WHERE id = ${bid}`;
  if (!b || b.status !== "pending") return;
  let customerId: string;
  const [existing] = await sql<{ id: string }[]>`SELECT id FROM customers WHERE phone = ${b.phone} LIMIT 1`;
  if (existing) customerId = existing.id;
  else {
    customerId = crypto.randomUUID();
    await sql`INSERT INTO customers (id, name, phone, email, address, notes) VALUES (
      ${customerId}, ${b.name}, ${b.phone}, ${b.customer_email || ""}, ${b.address}, ${"From public booking"}
    )`;
  }
  const vehicleId = crypto.randomUUID();
  let year: number | null = b.vehicle_year ? Number(b.vehicle_year) : null;
  let make = String(b.vehicle_make || "");
  let model = String(b.vehicle_model || "");
  const engine = String(b.vehicle_engine || "");
  if (!make) {
    const bits = b.vehicle.split(/\s+/);
    if (bits[0] && /^\d{4}$/.test(bits[0])) {
      year = Number(bits[0]);
      make = bits[1] ?? "";
      model = bits.slice(2).join(" ");
    } else {
      make = bits[0] ?? b.vehicle;
      model = bits.slice(1).join(" ");
    }
  }
  await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, history_notes) VALUES (
    ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${"Created from booking"}
  )`;
  const jobId = crypto.randomUUID();
  const notesBit = b.notes ? ` Notes: ${b.notes}` : "";
  const complaint = `${b.issue}${notesBit}${b.preferred_time ? ` Preferred: ${b.preferred_time}` : ""}`;
  await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, address, complaint, services) VALUES (
    ${jobId}, ${customerId}, ${vehicleId}, 'scheduled', ${b.address}, ${complaint}, ${b.services || "[]"}
  )`;
  await sql`UPDATE bookings SET status = 'accepted' WHERE id = ${bid}`;
  revalidatePath("/bookings");
  redirect(`/jobs/${jobId}`);
}

export async function decodeVinOnVehicle(vinRaw: string) {
  await requireSession();
  const vin = vinRaw.trim().toUpperCase();
  if (!vinOk(vin)) return { error: "VIN must be 17 characters (no I, O, or Q)." };
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { error: "NHTSA vPIC did not respond. Try again." };
  const json = (await res.json()) as { Results?: Array<Record<string, string>> };
  const row = json.Results?.[0];
  if (!row) return { error: "No decode result." };
  const errorCode = row.ErrorCode ?? "";
  const year = row.ModelYear && row.ModelYear !== "" ? Number(row.ModelYear) : null;
  const make = row.Make || "";
  const model = row.Model || "";
  if (!make && !model && errorCode && errorCode !== "0") {
    return { error: row.ErrorText || "Invalid VIN — NHTSA could not decode it." };
  }
  if (!make && !model) {
    return { error: "Invalid VIN — NHTSA returned no year/make/model." };
  }
  return { vin, year, make, model, error: null as string | null };
}


