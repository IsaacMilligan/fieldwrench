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
import { formatServiceList, isServiceId, servicesToJson, type ServiceId } from "./services";
import { ELECTRIC_ENGINE, isElectricEngine } from "./vpic";
import { oilYmmeKey } from "./oil-specs";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function ymmFrom(form: FormData) {
  const year = parseNumber(str(form, "vehicle_year") || str(form, "year")) || null;
  const make = str(form, "vehicle_make") || str(form, "make");
  const model = str(form, "vehicle_model") || str(form, "model");
  let engine = str(form, "vehicle_engine") || str(form, "engine");
  if (engine === "__unsure__") engine = "";
  if (isElectricEngine(engine)) engine = ELECTRIC_ENGINE;
  const vinRaw = str(form, "vin").toUpperCase();
  const vin = vinOk(vinRaw) ? vinRaw : "";
  return { year, make, model, engine, vin };
}

export async function loginAction(_prev: { error?: string } | null, form: FormData) {
  try {
    await import("./db/index").then((m) => m.ensureReady());
    const email = str(form, "email").toLowerCase();
    const password = str(form, "password");
    const ok = await verifyLogin(email, password);
    if (!ok) return { error: "Wrong email or password." };
    await createSession(ok);
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
    await createSession(ok);
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
  const s = await requireSession();
  const sql = await db();
  const shop = str(form, "shop_name") || "FieldWrench";
  const labor = parseMoney(str(form, "labor_rate"));
  const miles = Math.round(parseNumber(str(form, "mileage_rate")) * 100) / 100;
  const mileageCents = Math.round(miles);
  const lead = Math.min(168, Math.max(0, Math.round(parseNumber(str(form, "lead_hours")))));
  await sql`UPDATE settings SET shop_name = ${shop}, labor_rate_cents = ${labor}, mileage_rate_cents = ${mileageCents}, lead_hours = ${lead} WHERE shop_id = ${s.shopId}`;
  revalidatePath("/");
  revalidatePath("/book");
  redirect("/more?tab=settings");
}

export async function saveThemeAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const theme = str(form, "theme") === "dark" ? "dark" : "light";
  await sql`UPDATE settings SET theme = ${theme} WHERE shop_id = ${s.shopId}`;
  revalidatePath("/", "layout");
  revalidatePath("/book");
  revalidatePath("/more");
}

export async function resetDemoAction() {
  const s = await requireSession();
  if (!s.isDemo) return;
  const sql = getSql();
  await seedDemo(sql);
  revalidatePath("/");
  redirect("/");
}

export async function createCustomerAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  await sql`INSERT INTO customers (id, name, phone, email, address, notes, shop_id) VALUES (
    ${id}, ${str(form, "name") || "Customer"}, ${str(form, "phone")}, ${str(form, "email")},
    ${str(form, "address")}, ${str(form, "notes")}, ${s.shopId}
  )`;
  const ymm = ymmFrom(form);
  if (ymm.year && ymm.make && ymm.model) {
    await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, vin, shop_id) VALUES (
      ${crypto.randomUUID()}, ${id}, ${ymm.year}, ${ymm.make}, ${ymm.model}, ${ymm.engine}, ${ymm.vin}, ${s.shopId}
    )`;
  }
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

export async function deleteCustomerAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  if (!id) return;
  await sql`
    UPDATE jobs j SET
      customer_name = CASE
        WHEN COALESCE(j.customer_name, '') = '' THEN COALESCE(c.name, 'Deleted customer')
        ELSE j.customer_name
      END,
      vehicle_year = COALESCE(j.vehicle_year, v.year),
      vehicle_make = CASE
        WHEN COALESCE(j.vehicle_make, '') = '' THEN COALESCE(v.make, '')
        ELSE j.vehicle_make
      END,
      vehicle_model = CASE
        WHEN COALESCE(j.vehicle_model, '') = '' THEN COALESCE(v.model, '')
        ELSE j.vehicle_model
      END,
      updated_at = NOW()
    FROM customers c
    LEFT JOIN vehicles v ON v.id = j.vehicle_id
    WHERE j.customer_id = ${id} AND c.id = ${id}
  `;
  await sql`UPDATE jobs SET customer_id = NULL, vehicle_id = NULL WHERE customer_id = ${id}`;
  await sql`DELETE FROM vehicles WHERE customer_id = ${id}`;
  await sql`DELETE FROM customers WHERE id = ${id}`;
  revalidatePath("/customers");
  revalidatePath("/jobs");
  revalidatePath("/");
  revalidatePath("/calendar");
  redirect("/customers");
}

export async function createVehicleAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  const customerId = str(form, "customer_id");
  const ymm = ymmFrom(form);
  const mileage = parseNumber(str(form, "mileage")) || null;
  await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, plate, vin, mileage, history_notes, shop_id) VALUES (
    ${id}, ${customerId}, ${ymm.year}, ${ymm.make}, ${ymm.model}, ${ymm.engine},
    ${str(form, "plate")}, ${ymm.vin || str(form, "vin").toUpperCase()}, ${mileage}, ${str(form, "history_notes")}, ${s.shopId}
  )`;
  revalidatePath(`/customers/${customerId}`);
  redirect(`/vehicles/${id}`);
}

export async function updateVehicleAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const ymm = ymmFrom(form);
  const mileage = parseNumber(str(form, "mileage")) || null;
  await sql`UPDATE vehicles SET
    year = ${ymm.year},
    make = ${ymm.make},
    model = ${ymm.model},
    engine = ${ymm.engine},
    plate = ${str(form, "plate")},
    vin = ${str(form, "vin").toUpperCase()},
    mileage = ${mileage},
    history_notes = ${str(form, "history_notes")}
    WHERE id = ${id}`;
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function saveOilSpecAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const qt = parseNumber(str(form, "oil_qt"));
  const vis = str(form, "oil_viscosity");
  const tq = parseNumber(str(form, "oil_drain_tq"));
  const socket = str(form, "oil_socket");
  if (!id || (!qt && !vis && !tq && !socket)) redirect(`/vehicles/${id || ""}`);
  const [veh] = await sql<{ year: number | null; make: string; model: string; engine: string }[]>`
    SELECT year, make, model, engine FROM vehicles WHERE id = ${id}
  `;
  if (isElectricEngine(veh?.engine)) {
    const next = str(form, "next") || `/vehicles/${id}`;
    redirect(next);
  }
  await sql`UPDATE vehicles SET
    oil_qt = ${qt || null},
    oil_viscosity = ${vis},
    oil_drain_tq = ${tq || null},
    oil_socket = ${socket},
    oil_saved = 1
    WHERE id = ${id}`;
  const key = oilYmmeKey(veh?.year, veh?.make, veh?.model, veh?.engine);
  if (key) {
    await sql`
      INSERT INTO oil_defaults (id, year, make_key, model_key, engine_key, oil_qt, oil_viscosity, oil_drain_tq, oil_socket, shop_id, updated_at)
      VALUES (${crypto.randomUUID()}, ${key.year}, ${key.make_key}, ${key.model_key}, ${key.engine_key}, ${qt || null}, ${vis}, ${tq || null}, ${socket}, ${s.shopId}, NOW())
      ON CONFLICT (shop_id, year, make_key, model_key, engine_key)
      DO UPDATE SET
        oil_qt = EXCLUDED.oil_qt,
        oil_viscosity = EXCLUDED.oil_viscosity,
        oil_drain_tq = EXCLUDED.oil_drain_tq,
        oil_socket = EXCLUDED.oil_socket,
        updated_at = NOW()
    `;
  }
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/tools");
  revalidatePath("/jobs");
  const next = str(form, "next") || `/vehicles/${id}`;
  redirect(next);
}

export async function applyVinAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "vehicle_id");
  const year = parseNumber(str(form, "year")) || null;
  const make = str(form, "make");
  const model = str(form, "model");
  let engine = str(form, "engine");
  if (isElectricEngine(engine)) engine = ELECTRIC_ENGINE;
  const vin = str(form, "vin").toUpperCase();
  const qt = parseNumber(str(form, "oil_qt"));
  const vis = str(form, "oil_viscosity");

  if (id === "__new__") {
    const name = str(form, "name");
    const phone = str(form, "phone");
    if (!name || !phone) redirect("/tools");
    const customerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const plate = str(form, "plate");
    const mileage = parseNumber(str(form, "mileage")) || 0;
    await sql`INSERT INTO customers (id, name, phone, shop_id) VALUES (
      ${customerId}, ${name}, ${phone}, ${s.shopId}
    )`;
    await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, vin, plate, mileage, shop_id) VALUES (
      ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${vin}, ${plate}, ${mileage}, ${s.shopId}
    )`;
    revalidatePath("/customers");
    revalidatePath("/tools");
    revalidatePath(`/vehicles/${vehicleId}`);
    redirect(`/vehicles/${vehicleId}`);
  }

  const [owned] = await sql<{ id: string; vin: string }[]>`
    SELECT id, vin FROM vehicles WHERE id = ${id} AND shop_id = ${s.shopId}
  `;
  if (!owned) redirect("/tools");

  if (qt || vis) {
    await sql`UPDATE vehicles SET
      year = ${year},
      make = ${make},
      model = ${model},
      vin = ${vin},
      engine = ${engine},
      oil_qt = ${qt || null},
      oil_viscosity = ${vis},
      oil_saved = 1
      WHERE id = ${id} AND shop_id = ${s.shopId}`;
  } else {
    await sql`UPDATE vehicles SET
      year = ${year},
      make = ${make},
      model = ${model},
      vin = ${vin},
      engine = ${engine}
      WHERE id = ${id} AND shop_id = ${s.shopId}`;
  }
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

export async function createJobAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = crypto.randomUUID();
  const services = form
    .getAll("service")
    .map(String)
    .filter(isServiceId) as ServiceId[];
  const notes = str(form, "notes");
  if (!services.length) redirect("/jobs?new=1");
  const complaint = formatServiceList(services);
  const status = (JOB_STATUSES.includes(str(form, "status") as JobStatus)
    ? str(form, "status")
    : "scheduled") as JobStatus;
  const when = str(form, "scheduled_at");
  const scheduled = when ? new Date(when).toISOString() : null;
  const address = str(form, "address");

  let customerId = str(form, "customer_id");
  let vehicleId = str(form, "vehicle_id");
  if (vehicleId === "__new__") vehicleId = "";

  const year = parseNumber(str(form, "vehicle_year")) || null;
  const make = str(form, "vehicle_make");
  const model = str(form, "vehicle_model");
  let engine = str(form, "vehicle_engine");
  if (engine === "__unsure__") engine = "";
  if (isElectricEngine(engine)) engine = ELECTRIC_ENGINE;
  const vinRaw = str(form, "vin").toUpperCase();
  const vin = vinOk(vinRaw) ? vinRaw : "";

  if (str(form, "new_customer") === "1") {
    const name = str(form, "name");
    const phone = str(form, "phone");
    if (!name || !phone || !year || !make || !model) redirect("/jobs?new=1");
    customerId = crypto.randomUUID();
    vehicleId = crypto.randomUUID();
    await sql`INSERT INTO customers (id, name, phone, email, shop_id) VALUES (
      ${customerId}, ${name}, ${phone}, ${str(form, "email")}, ${s.shopId}
    )`;
    await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, vin, shop_id) VALUES (
      ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${vin}, ${s.shopId}
    )`;
  } else {
    if (!customerId) redirect("/jobs?new=1");
    if (!vehicleId) {
      if (!year || !make || !model) redirect("/jobs?new=1");
      vehicleId = crypto.randomUUID();
      await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, vin, shop_id) VALUES (
        ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${vin}, ${s.shopId}
      )`;
    } else {
      const [veh] = await sql<{ customer_id: string }[]>`SELECT customer_id FROM vehicles WHERE id = ${vehicleId}`;
      if (!veh || veh.customer_id !== customerId) redirect("/jobs?new=1");
    }
  }

  await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, scheduled_at, address, complaint, services, notes, shop_id)
    VALUES (${id}, ${customerId}, ${vehicleId}, ${status}, ${scheduled}, ${address},
      ${complaint}, ${servicesToJson(services)}, ${notes}, ${s.shopId})`;
  revalidatePath("/jobs");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/jobs/${id}`);
}

export async function updateJobAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const status = str(form, "status") as JobStatus;
  if (!JOB_STATUSES.includes(status)) return;
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
  revalidatePath("/");
}

export async function deleteJobAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const id = str(form, "id");
  if (!id) return;
  await sql`DELETE FROM jobs WHERE id = ${id}`;
  revalidatePath("/jobs");
  revalidatePath("/");
  revalidatePath("/calendar");
  redirect("/jobs");
}

export async function addLaborAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const isFlat = str(form, "mode") === "flat";
  const settings = (await sql<{ labor_rate_cents: number }[]>`SELECT labor_rate_cents FROM settings WHERE shop_id = ${s.shopId} LIMIT 1`)[0];
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
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id") || null;
  const id = crypto.randomUUID();
  const file = form.get("file");
  let photoUrl = "";
  if (file instanceof File && file.size > 0) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      const blob = await put(`receipts/${id}`, Buffer.from(await file.arrayBuffer()), {
        access: "public",
        contentType: file.type || "image/jpeg",
        token,
      });
      photoUrl = blob.url;
    }
  }
  await sql`INSERT INTO receipts (id, amount_cents, vendor, category, date, job_id, photo_url, shop_id) VALUES (
    ${id}, ${parseMoney(str(form, "amount"))}, ${str(form, "vendor") || "Vendor"},
    ${str(form, "category") || "parts"}, ${str(form, "date")}, ${jobId}, ${photoUrl}, ${s.shopId}
  )`;
  revalidatePath("/more");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  redirect("/more?tab=receipts");
}

export async function addMileageAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id") || null;
  await sql`INSERT INTO mileage_trips (id, miles, purpose, job_id, date, shop_id) VALUES (
    ${crypto.randomUUID()}, ${parseNumber(str(form, "miles"))}, ${str(form, "purpose") || "Shop miles"},
    ${jobId}, ${str(form, "date")}, ${s.shopId}
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

export async function restoreBookingAction(form: FormData) {
  await requireSession();
  const sql = await db();
  await sql`UPDATE bookings SET status = 'pending' WHERE id = ${str(form, "id")} AND status = 'dismissed'`;
  revalidatePath("/bookings");
  revalidatePath("/");
}

export async function dismissBookingAction(form: FormData) {
  await requireSession();
  const sql = await db();
  await sql`UPDATE bookings SET status = 'dismissed' WHERE id = ${str(form, "id")}`;
  revalidatePath("/bookings");
  revalidatePath("/");
}

export async function acceptBookingAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const bid = str(form, "id");
  const [b] = await sql<{
    name: string; phone: string; address: string; vehicle: string; issue: string;
    preferred_time: string; status: string; services: string; notes: string; customer_email: string;
    vehicle_year: number | null; vehicle_make: string; vehicle_model: string; vehicle_engine: string;
    preferred_date: string | null;
  }[]>`SELECT * FROM bookings WHERE id = ${bid}`;
  if (!b || b.status !== "pending") return;
  let customerId: string;
  const [existing] = await sql<{ id: string }[]>`SELECT id FROM customers WHERE shop_id = ${s.shopId} AND phone = ${b.phone} LIMIT 1`;
  if (existing) customerId = existing.id;
  else {
    customerId = crypto.randomUUID();
    await sql`INSERT INTO customers (id, name, phone, email, address, notes, shop_id) VALUES (
      ${customerId}, ${b.name}, ${b.phone}, ${b.customer_email || ""}, ${b.address}, ${"From public booking"}, ${s.shopId}
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
  await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, history_notes, shop_id) VALUES (
    ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${"Created from booking"}, ${s.shopId}
  )`;
  const jobId = crypto.randomUUID();
  const notesBit = b.notes ? ` Notes: ${b.notes}` : "";
  const dateBit = b.preferred_date ? ` Preferred date: ${String(b.preferred_date).slice(0, 10)}` : "";
  const complaint = `${b.issue}${notesBit}${dateBit}`;
  await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, address, complaint, services, shop_id) VALUES (
    ${jobId}, ${customerId}, ${vehicleId}, 'scheduled', ${b.address}, ${complaint}, ${b.services || "[]"}, ${s.shopId}
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


