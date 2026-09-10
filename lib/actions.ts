"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { putPrivateBlob, delPrivateBlob, blobConfigured, blobUserMessage } from "./blob";
import { DEMO, clearSession, createSession, requireSession, verifyLogin } from "./auth";
import { getCustomerUser } from "./supabase/server";
import { db, ensureInvoice } from "./db/queries";
import { seedDemo } from "./db/seed";
import { getSql } from "./db/index";
import { parseMoney, parseNumber, vinOk } from "./format";
import type { JobStatus, PayMethod } from "./status";
import { JOB_STATUSES, PAY_METHODS } from "./status";
import { formatServiceList, isServiceId, servicesToJson, SERVICES, type ServiceId } from "./services";
import { ELECTRIC_ENGINE, isElectricEngine } from "./vpic";
import { oilYmmeKey } from "./oil-specs";
import { oilChargeCents } from "./oil-cost";
import { catalogTag, categoryForTag, catalogLaborMode } from "./catalog";
import { geocodeAddress } from "./geocode";
import { applyJobTemplateToJob } from "./apply-job-template";
import { prepareJobPhoto } from "./job-photo";
import { templateKind } from "./job-templates";
import {
  DEFAULT_BUFFER_MIN,
  DEFAULT_HOME_BASE,
  DEFAULT_HOURS,
  DEFAULT_RADIUS_MI,
  parseHours,
  parseServiceDurations,
  clampSlotStep,
  parseStartClock,
  windowHour,
} from "./schedule";

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
  const tax = Math.max(0, parseNumber(str(form, "parts_tax_rate")));
  const homeBase = str(form, "home_base") || DEFAULT_HOME_BASE;
  const radius = Math.max(1, parseNumber(str(form, "service_radius_mi")) || DEFAULT_RADIUS_MI);
  const buffer = Math.max(0, Math.round(parseNumber(str(form, "job_buffer_min")) || DEFAULT_BUFFER_MIN));
  const hours = DEFAULT_HOURS.map((d, i) => ({
    open: str(form, `hours_${i}_open`) === "1",
    start: str(form, `hours_${i}_start`) || d.start,
    end: str(form, `hours_${i}_end`) || d.end,
  }));
  const hoursJson = JSON.stringify(parseHours(hours));
  const durations = parseServiceDurations(
    Object.fromEntries(SERVICES.map((svc) => [svc.id, str(form, `duration_${svc.id}`)])),
  );
  const durationsJson = JSON.stringify(durations);
  const slotStep = clampSlotStep(str(form, "slot_step_min"));
  const pickedLat = Number(str(form, "home_lat"));
  const pickedLng = Number(str(form, "home_lng"));
  const geo =
    Number.isFinite(pickedLat) && Number.isFinite(pickedLng) && str(form, "home_lat")
      ? { lat: pickedLat, lng: pickedLng }
      : await geocodeAddress(homeBase);
  await sql`UPDATE settings SET shop_name = ${shop}, labor_rate_cents = ${labor}, mileage_rate_cents = ${mileageCents}, lead_hours = ${lead}, parts_tax_rate = ${tax},
    home_base = ${homeBase}, home_lat = ${geo?.lat ?? null}, home_lng = ${geo?.lng ?? null}, service_radius_mi = ${radius}, job_buffer_min = ${buffer}, hours_json = ${hoursJson},
    service_durations_json = ${durationsJson}, slot_step_min = ${slotStep}
    WHERE shop_id = ${s.shopId}`;
  revalidatePath("/");
  revalidatePath("/book");
  revalidatePath("/calendar");
  redirect("/more?tab=settings");
}

function discountFields(form: FormData) {
  const name = str(form, "name") || "Discount";
  const kind = str(form, "kind") === "amount" ? "amount" : "percent";
  const raw = parseNumber(str(form, "value"));
  const pct = kind === "percent" ? Math.max(0, raw) : 0;
  const amount_cents = kind === "amount" ? parseMoney(str(form, "value")) : 0;
  return { name, kind, pct, amount_cents };
}

export async function addDiscountPresetAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const d = discountFields(form);
  await sql`INSERT INTO discount_presets (id, shop_id, name, kind, pct, amount_cents) VALUES (
    ${crypto.randomUUID()}, ${s.shopId}, ${d.name}, ${d.kind}, ${d.pct}, ${d.amount_cents}
  )`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function updateDiscountPresetAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const d = discountFields(form);
  await sql`UPDATE discount_presets SET name = ${d.name}, kind = ${d.kind}, pct = ${d.pct}, amount_cents = ${d.amount_cents}
    WHERE id = ${id} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function deleteDiscountPresetAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  await sql`DELETE FROM discount_presets WHERE id = ${str(form, "id")} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function addJobDiscountAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const presetId = str(form, "preset_id");
  if (presetId) {
    const [p] = await sql<{ name: string; kind: string; pct: number; amount_cents: number }[]>`
      SELECT name, kind, pct, amount_cents FROM discount_presets WHERE id = ${presetId} AND shop_id = ${s.shopId}
    `;
    if (p) {
      await sql`INSERT INTO job_discounts (id, job_id, name, kind, pct, amount_cents) VALUES (
        ${crypto.randomUUID()}, ${jobId}, ${p.name}, ${p.kind}, ${p.pct}, ${p.amount_cents}
      )`;
    }
  } else {
    const d = discountFields(form);
    await sql`INSERT INTO job_discounts (id, job_id, name, kind, pct, amount_cents) VALUES (
      ${crypto.randomUUID()}, ${jobId}, ${d.name}, ${d.kind}, ${d.pct}, ${d.amount_cents}
    )`;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/invoices/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

export async function deleteJobDiscountAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  await sql`DELETE FROM job_discounts WHERE id = ${str(form, "id")}`;
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/invoices/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

function catalogFields(form: FormData) {
  const name = str(form, "name") || "Item";
  const tag = catalogTag(str(form, "tag"), name);
  const category = categoryForTag(tag);
  const cost = parseMoney(str(form, "cost"));
  const price = parseMoney(str(form, "price"));
  const sell = price > cost ? price : cost;
  const jugQt = parseNumber(str(form, "jug_qt")) || 5;
  let jugCents = parseMoney(str(form, "jug_cost"));
  if (tag === "oil") {
    if (!jugCents && cost) jugCents = cost;
    if (!cost && jugCents) {
      return { name, tag, category, cost: jugCents, sell: price > jugCents ? price : jugCents, jugQt, jugCents, laborMode: "fixed" as const, laborHours: 1 };
    }
  }
  const laborMode = tag === "labor" ? catalogLaborMode(str(form, "labor_mode")) : "fixed";
  const laborHours = tag === "labor" && laborMode === "hours" ? Math.max(0.01, parseNumber(str(form, "labor_hours")) || 1) : 1;
  if (tag === "labor" && laborMode === "hours") {
    return { name, tag, category, cost: 0, sell: 0, jugQt, jugCents, laborMode, laborHours };
  }
  if (tag === "labor") {
    const flat = cost || sell;
    return { name, tag, category, cost: flat, sell: flat, jugQt, jugCents, laborMode, laborHours: 1 };
  }
  return { name, tag, category, cost, sell, jugQt, jugCents, laborMode, laborHours };
}

export async function addCatalogItemAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const c = catalogFields(form);
  await sql`INSERT INTO catalog_items (id, shop_id, name, category, cost_cents, price_cents, jug_qt, jug_cents, tag, labor_mode, labor_hours) VALUES (
    ${crypto.randomUUID()}, ${s.shopId}, ${c.name}, ${c.category}, ${c.cost}, ${c.sell}, ${c.jugQt}, ${c.jugCents}, ${c.tag}, ${c.laborMode}, ${c.laborHours}
  )`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function updateCatalogItemAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const c = catalogFields(form);
  await sql`UPDATE catalog_items SET name = ${c.name}, category = ${c.category}, tag = ${c.tag}, cost_cents = ${c.cost}, price_cents = ${c.sell}, jug_qt = ${c.jugQt}, jug_cents = ${c.jugCents}, labor_mode = ${c.laborMode}, labor_hours = ${c.laborHours}
    WHERE id = ${id} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function deleteCatalogItemAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  await sql`DELETE FROM catalog_items WHERE id = ${str(form, "id")} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
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
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const fail = (msg: string) => redirect(`/customers?e=${encodeURIComponent(msg)}`);
  if (!id) fail("Missing customer.");
  const [c] = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM customers WHERE id = ${id} AND shop_id = ${s.shopId}
  `;
  if (!c) fail("Customer not found in this shop.");
  const frozen = c.name.trim() || "Deleted customer";
  await sql`
    UPDATE jobs SET
      customer_name = CASE WHEN COALESCE(customer_name, '') = '' THEN ${frozen} ELSE customer_name END,
      vehicle_year = COALESCE(vehicle_year, (SELECT year FROM vehicles WHERE vehicles.id = jobs.vehicle_id)),
      vehicle_make = CASE
        WHEN COALESCE(vehicle_make, '') = '' THEN COALESCE((SELECT make FROM vehicles WHERE vehicles.id = jobs.vehicle_id), '')
        ELSE vehicle_make
      END,
      vehicle_model = CASE
        WHEN COALESCE(vehicle_model, '') = '' THEN COALESCE((SELECT model FROM vehicles WHERE vehicles.id = jobs.vehicle_id), '')
        ELSE vehicle_model
      END,
      updated_at = NOW()
    WHERE customer_id = ${id}
      OR vehicle_id IN (SELECT id FROM vehicles WHERE customer_id = ${id})
  `;
  const unlink = async () => {
    await sql`
      UPDATE jobs SET customer_id = NULL
      WHERE customer_id = ${id}
    `;
    await sql`
      UPDATE jobs SET vehicle_id = NULL
      WHERE vehicle_id IN (SELECT id FROM vehicles WHERE customer_id = ${id})
    `;
  };
  try {
    await unlink();
  } catch {
    const { getSql } = await import("./db/index");
    const raw = getSql();
    await raw.unsafe(`ALTER TABLE jobs ALTER COLUMN customer_id DROP NOT NULL`).catch(() => {});
    await raw.unsafe(`ALTER TABLE jobs ALTER COLUMN vehicle_id DROP NOT NULL`).catch(() => {});
    try {
      await unlink();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(msg.slice(0, 160) || "Could not unlink jobs.");
    }
  }
  try {
    await sql`DELETE FROM vehicles WHERE customer_id = ${id}`;
    const gone = await sql<{ id: string }[]>`
      DELETE FROM customers WHERE id = ${id} AND shop_id = ${s.shopId} RETURNING id
    `;
    if (!gone.length) fail("Could not delete this customer.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(msg.slice(0, 160) || "Could not delete this customer.");
  }
  revalidatePath("/customers");
  revalidatePath("/jobs");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/tools");
  redirect("/customers?deleted=1");
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
  const specId = str(form, "spec_id");
  const id = str(form, "id");
  const qt = parseNumber(str(form, "oil_qt"));
  const vis = str(form, "oil_viscosity");
  const tq = parseNumber(str(form, "oil_drain_tq"));
  const socket = str(form, "oil_socket");
  if (specId) {
    const [row] = await sql<{ id: string; engine_label: string }[]>`
      SELECT id, engine_label FROM oil_defaults WHERE id = ${specId} AND shop_id = ${s.shopId}
    `;
    if (!row) redirect("/tools");
    if (isElectricEngine(row.engine_label)) redirect(`/specs/${specId}`);
    await sql`UPDATE oil_defaults SET
      oil_qt = ${qt || null},
      oil_viscosity = ${vis},
      oil_drain_tq = ${tq || null},
      oil_socket = ${socket},
      updated_at = NOW()
      WHERE id = ${specId} AND shop_id = ${s.shopId}`;
    revalidatePath(`/specs/${specId}`);
    revalidatePath("/tools");
    redirect(`/specs/${specId}`);
  }
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
      INSERT INTO oil_defaults (id, year, make_key, model_key, engine_key, oil_qt, oil_viscosity, oil_drain_tq, oil_socket, shop_id, make_label, model_label, engine_label, updated_at)
      VALUES (${crypto.randomUUID()}, ${key.year}, ${key.make_key}, ${key.model_key}, ${key.engine_key}, ${qt || null}, ${vis}, ${tq || null}, ${socket}, ${s.shopId}, ${veh?.make || ""}, ${veh?.model || ""}, ${veh?.engine || ""}, NOW())
      ON CONFLICT (shop_id, year, make_key, model_key, engine_key)
      DO UPDATE SET
        oil_qt = EXCLUDED.oil_qt,
        oil_viscosity = EXCLUDED.oil_viscosity,
        oil_drain_tq = EXCLUDED.oil_drain_tq,
        oil_socket = EXCLUDED.oil_socket,
        make_label = EXCLUDED.make_label,
        model_label = EXCLUDED.model_label,
        engine_label = EXCLUDED.engine_label,
        updated_at = NOW()
    `;
  }
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/tools");
  revalidatePath("/jobs");
  const next = str(form, "next") || `/vehicles/${id}`;
  redirect(next);
}

export async function saveShopSpecAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const year = parseNumber(str(form, "year")) || null;
  const make = str(form, "make");
  const model = str(form, "model");
  let engine = str(form, "engine");
  if (isElectricEngine(engine)) engine = ELECTRIC_ENGINE;
  const vin = str(form, "vin").toUpperCase();
  const trim = str(form, "trim");
  const body = str(form, "body");
  const drive = str(form, "drive");
  const qt = parseNumber(str(form, "oil_qt"));
  const vis = str(form, "oil_viscosity");
  const tq = parseNumber(str(form, "oil_drain_tq"));
  const socket = str(form, "oil_socket");
  const key = oilYmmeKey(year, make, model, engine);
  if (!key) redirect("/tools");
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO oil_defaults (
      id, year, make_key, model_key, engine_key, shop_id,
      make_label, model_label, engine_label, trim, body, drive, vin,
      oil_qt, oil_viscosity, oil_drain_tq, oil_socket, updated_at
    ) VALUES (
      ${crypto.randomUUID()}, ${key.year}, ${key.make_key}, ${key.model_key}, ${key.engine_key}, ${s.shopId},
      ${make}, ${model}, ${engine}, ${trim}, ${body}, ${drive}, ${vin},
      ${qt || null}, ${vis}, ${tq || null}, ${socket}, NOW()
    )
    ON CONFLICT (shop_id, year, make_key, model_key, engine_key)
    DO UPDATE SET
      make_label = EXCLUDED.make_label,
      model_label = EXCLUDED.model_label,
      engine_label = EXCLUDED.engine_label,
      trim = CASE WHEN EXCLUDED.trim = '' THEN oil_defaults.trim ELSE EXCLUDED.trim END,
      body = CASE WHEN EXCLUDED.body = '' THEN oil_defaults.body ELSE EXCLUDED.body END,
      drive = CASE WHEN EXCLUDED.drive = '' THEN oil_defaults.drive ELSE EXCLUDED.drive END,
      vin = CASE WHEN EXCLUDED.vin = '' THEN oil_defaults.vin ELSE EXCLUDED.vin END,
      oil_qt = COALESCE(EXCLUDED.oil_qt, oil_defaults.oil_qt),
      oil_viscosity = CASE WHEN EXCLUDED.oil_viscosity = '' THEN oil_defaults.oil_viscosity ELSE EXCLUDED.oil_viscosity END,
      oil_drain_tq = COALESCE(EXCLUDED.oil_drain_tq, oil_defaults.oil_drain_tq),
      oil_socket = CASE WHEN EXCLUDED.oil_socket = '' THEN oil_defaults.oil_socket ELSE EXCLUDED.oil_socket END,
      updated_at = NOW()
    RETURNING id
  `;
  if (!row?.id) redirect("/tools");
  revalidatePath("/tools");
  redirect(`/specs/${row.id}`);
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
  const trim = str(form, "trim");
  const body = str(form, "body");
  const drive = str(form, "drive");
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
    await sql`INSERT INTO vehicles (id, customer_id, year, make, model, engine, vin, plate, mileage, trim, body, drive, shop_id) VALUES (
      ${vehicleId}, ${customerId}, ${year}, ${make}, ${model}, ${engine}, ${vin}, ${plate}, ${mileage}, ${trim}, ${body}, ${drive}, ${s.shopId}
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
      trim = ${trim},
      body = ${body},
      drive = ${drive},
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
      engine = ${engine},
      trim = ${trim},
      body = ${body},
      drive = ${drive}
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
  const templateId = str(form, "template_id");
  if (templateId) {
    const applied = await applyJobTemplateToJob({
      shopId: s.shopId,
      jobId: id,
      templateId,
      mode: "replace",
    });
    revalidatePath("/jobs");
    revalidatePath(`/customers/${customerId}`);
    if (applied.bevBlocked) redirect(`/jobs/${id}?e=bev`);
    if (applied.oilNeed) redirect(`/jobs/${id}?oil=need`);
    redirect(`/jobs/${id}`);
  }
  revalidatePath("/jobs");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/jobs/${id}`);
}

export async function applyJobTemplateAction(form: FormData) {
  const s = await requireSession();
  const jobId = str(form, "job_id");
  const templateId = str(form, "template_id");
  const mode = str(form, "mode") === "merge" ? "merge" : "replace";
  if (!jobId || !templateId) redirect(jobId ? `/jobs/${jobId}` : "/jobs");
  const applied = await applyJobTemplateToJob({
    shopId: s.shopId,
    jobId,
    templateId,
    mode,
  });
  revalidatePath(`/jobs/${jobId}`);
  if (applied.bevBlocked) redirect(`/jobs/${jobId}?e=bev`);
  if (applied.oilNeed) redirect(`/jobs/${jobId}?oil=need`);
  redirect(`/jobs/${jobId}`);
}

export async function updateJobTemplateAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const name = str(form, "name") || "Template";
  const labor = parseMoney(str(form, "labor"));
  const range = str(form, "price_range_label");
  const notes = str(form, "notes");
  const active = str(form, "active") === "1" ? 1 : 0;
  await sql`UPDATE job_templates SET name = ${name}, default_labor_cents = ${labor}, price_range_label = ${range}, notes = ${notes}, active = ${active}
    WHERE id = ${id} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect(`/more/templates/${id}`);
}

export async function archiveJobTemplateAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  await sql`UPDATE job_templates SET active = 0 WHERE id = ${id} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function reorderJobTemplateAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const id = str(form, "id");
  const dir = str(form, "dir") === "up" ? -15 : 15;
  await sql`UPDATE job_templates SET sort_order = sort_order + ${dir} WHERE id = ${id} AND shop_id = ${s.shopId}`;
  revalidatePath("/more");
  redirect("/more?tab=settings");
}

export async function addJobTemplateLineAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const templateId = str(form, "template_id");
  const kind = templateKind(str(form, "kind"));
  const label = str(form, "label") || "Line";
  const match = str(form, "catalog_match");
  const optional = str(form, "optional") === "1" ? 1 : 0;
  await sql`INSERT INTO job_template_lines (id, template_id, kind, catalog_item_id, catalog_match, label, qty, unit_price_cents, sort_order, optional)
    VALUES (${crypto.randomUUID()}, ${templateId}, ${kind}, ${null}, ${match}, ${label}, 1, ${null}, 99, ${optional})`;
  revalidatePath("/more");
  redirect(`/more/templates/${templateId}`);
}

export async function deleteJobTemplateLineAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const templateId = str(form, "template_id");
  await sql`DELETE FROM job_template_lines WHERE id = ${str(form, "id")}`;
  revalidatePath("/more");
  redirect(`/more/templates/${templateId}`);
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
  const shopRate = Math.round(Number(settings?.labor_rate_cents) || 0);
  const rate = parseMoney(str(form, "rate")) || shopRate;
  const description = str(form, "description") || "Labor";
  const hours = parseNumber(str(form, "hours")) || (isFlat ? 0 : 1);
  const flat = parseMoney(str(form, "flat"));
  if (!isFlat && !rate) redirect(jobId ? `/jobs/${jobId}?e=rate` : "/more?tab=settings");
  if (str(form, "save_catalog") === "1") {
    const tag = catalogTag(str(form, "tag") || "labor", description);
    const category = categoryForTag(tag);
    const laborMode = isFlat ? "fixed" : catalogLaborMode(str(form, "labor_mode") || "hours");
    const laborHours = laborMode === "hours" ? Math.max(0.01, hours || 1) : 1;
    const stored = laborMode === "fixed" ? flat || rate : 0;
    await sql`INSERT INTO catalog_items (id, shop_id, name, category, cost_cents, price_cents, jug_qt, jug_cents, tag, labor_mode, labor_hours) VALUES (
      ${crypto.randomUUID()}, ${s.shopId}, ${description}, ${category}, ${stored}, ${stored}, 5, 0, ${tag}, ${laborMode}, ${laborHours}
    )`;
    revalidatePath("/more");
  }
  await sql`INSERT INTO labor_lines (id, job_id, description, hours, rate_cents, is_flat, flat_cents) VALUES (
    ${crypto.randomUUID()}, ${jobId}, ${description},
    ${hours}, ${rate}, ${isFlat ? 1 : 0}, ${flat}
  )`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateLaborAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const id = str(form, "id");
  const isFlat = str(form, "mode") === "flat";
  await sql`UPDATE labor_lines SET description = ${str(form, "description") || "Labor"}, hours = ${parseNumber(str(form, "hours"))},
    rate_cents = ${parseMoney(str(form, "rate"))}, is_flat = ${isFlat ? 1 : 0}, flat_cents = ${parseMoney(str(form, "flat"))}
    WHERE id = ${id}`;
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
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const description = str(form, "description") || "Part";
  const cost = parseMoney(str(form, "cost"));
  const price = parseMoney(str(form, "price"));
  const sell = price > cost ? price : cost;
  const qty = parseNumber(str(form, "qty")) || 1;
  if (str(form, "save_catalog") === "1") {
    const tag = catalogTag(str(form, "tag"), description);
    const category = categoryForTag(tag);
    const jugQt = parseNumber(str(form, "jug_qt")) || 5;
    const jugCents = tag === "oil" ? cost : 0;
    await sql`INSERT INTO catalog_items (id, shop_id, name, category, cost_cents, price_cents, jug_qt, jug_cents, tag) VALUES (
      ${crypto.randomUUID()}, ${s.shopId}, ${description}, ${category}, ${cost}, ${sell}, ${jugQt}, ${jugCents}, ${tag}
    )`;
    revalidatePath("/more");
  }
  await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
    ${crypto.randomUUID()}, ${jobId}, ${description}, ${qty}, ${cost}, ${sell}
  )`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function updatePartAction(form: FormData) {
  await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const id = str(form, "id");
  const description = str(form, "description") || "Part";
  const cost = parseMoney(str(form, "cost"));
  const price = parseMoney(str(form, "price"));
  const sell = price > cost ? price : cost;
  const qty = parseNumber(str(form, "qty")) || 1;
  await sql`UPDATE part_lines SET description = ${description}, qty = ${qty}, cost_cents = ${cost}, price_cents = ${sell} WHERE id = ${id}`;
  revalidatePath(`/jobs/${jobId}`);
}

export async function addOilPartAction(form: FormData) {
  const s = await requireSession();
  const sql = await db();
  const jobId = str(form, "job_id");
  const jugQt = parseNumber(str(form, "jug_qt")) || 5;
  const jugCents = parseMoney(str(form, "jug_cost"));
  const quarts = parseNumber(str(form, "quarts"));
  const vis = str(form, "viscosity");
  const catalogId = str(form, "catalog_id");
  const name = str(form, "description");
  const cents = oilChargeCents(jugCents, jugQt, quarts);
  if (!jobId || !cents || !(quarts > 0)) redirect(jobId ? `/jobs/${jobId}` : "/jobs");
  const qtLabel = String(quarts);
  const base = name || "Engine oil";
  const desc = vis ? `${base} · ${qtLabel} qt ${vis}` : `${base} · ${qtLabel} qt`;
  await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
    ${crypto.randomUUID()}, ${jobId}, ${desc}, 1, ${cents}, ${cents}
  )`;
  if (catalogId) {
    await sql`UPDATE catalog_items SET jug_qt = ${jugQt}, jug_cents = ${jugCents} WHERE id = ${catalogId} AND shop_id = ${s.shopId}`;
  } else if (str(form, "save_catalog") === "1") {
    const tag = catalogTag(str(form, "tag") || "oil", name || "Engine oil");
    const category = categoryForTag(tag);
    const label = name || "Engine oil";
    await sql`INSERT INTO catalog_items (id, shop_id, name, category, cost_cents, price_cents, jug_qt, jug_cents, tag) VALUES (
      ${crypto.randomUUID()}, ${s.shopId}, ${label}, ${category}, ${jugCents}, ${jugCents}, ${jugQt}, ${jugCents}, ${tag}
    )`;
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/more");
  redirect(`/jobs/${jobId}`);
}

export async function deletePartAction(form: FormData) {
  await requireSession();
  const sql = await db();
  await sql`DELETE FROM part_lines WHERE id = ${str(form, "id")}`;
  revalidatePath(`/jobs/${str(form, "job_id")}`);
}

export async function uploadPhotoAction(form: FormData) {
  const s = await requireSession();
  const jobId = str(form, "job_id");
  if (!jobId) throw new Error("Missing job.");
  if (!blobConfigured()) {
    console.error("upload_photo Blob storage not configured (need BLOB_STORE_ID+OIDC or BLOB_READ_WRITE_TOKEN)");
    throw new Error("Blob storage not configured");
  }
  const sql = await db();
  const [job] = await sql<{ id: string }[]>`SELECT id FROM jobs WHERE id = ${jobId} AND shop_id = ${s.shopId}`;
  if (!job) throw new Error("Job not found.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Pick a photo first.");
  const { buffer, contentType } = await prepareJobPhoto(file);
  const photoId = crypto.randomUUID();
  const pathname = `jobs/${jobId}/${photoId}.jpg`;
  let url = "";
  try {
    const blob = await putPrivateBlob(pathname, buffer, contentType);
    url = blob.url;
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    console.error("upload_photo blob", name, msg);
    throw new Error(blobUserMessage(e));
  }
  if (!url) throw new Error("Could not store that photo.");
  await sql`INSERT INTO photos (id, job_id, url, content_type, bytes, shop_id, pathname) VALUES (
    ${photoId}, ${jobId}, ${url}, ${contentType}, ${null}, ${s.shopId}, ${pathname}
  )`;
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}?photo=1`);
}

export async function deletePhotoAction(form: FormData) {
  const s = await requireSession();
  const jobId = str(form, "job_id");
  const photoId = str(form, "photo_id") || str(form, "id");
  if (!jobId || !photoId) throw new Error("Missing photo.");
  const sql = await db();
  const [row] = await sql<{ id: string; url: string; pathname: string | null }[]>`
    SELECT p.id, p.url, p.pathname
    FROM photos p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = ${photoId} AND p.job_id = ${jobId} AND j.shop_id = ${s.shopId}
  `;
  if (row) {
    const key = (row.pathname && row.pathname.trim()) || row.url || "";
    if (key) {
      try {
        await delPrivateBlob(key);
      } catch (e) {
        console.error("delete_photo blob", e instanceof Error ? e.message : e);
      }
    }
    await sql`DELETE FROM photos WHERE id = ${photoId} AND job_id = ${jobId} AND shop_id = ${s.shopId}`;
  }
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}?photo=1`);
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
  if (file instanceof File && file.size > 0 && blobConfigured()) {
    try {
      const blob = await putPrivateBlob(`receipts/${id}.bin`, Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg");
      photoUrl = blob.url;
    } catch (e) {
      console.error("receipt blob", e instanceof Error ? e.message : e);
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
  const dateIso = b.preferred_date ? String(b.preferred_date).slice(0, 10) : "";
  const dateBit = dateIso ? ` Preferred date: ${dateIso}` : "";
  const complaint = `${b.issue}${notesBit}${dateBit}`;
  const clock = parseStartClock(b.preferred_time);
  const hour = clock ? clock.hour : windowHour(b.preferred_time);
  const minute = clock ? clock.minute : 0;
  const local = dateIso
    ? `${dateIso} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
    : null;
  if (local) {
    await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, address, complaint, services, shop_id, scheduled_at) VALUES (
      ${jobId}, ${customerId}, ${vehicleId}, 'scheduled', ${b.address}, ${complaint}, ${b.services || "[]"}, ${s.shopId},
      ${local}::timestamp AT TIME ZONE 'America/Denver'
    )`;
  } else {
    await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, address, complaint, services, shop_id) VALUES (
      ${jobId}, ${customerId}, ${vehicleId}, 'scheduled', ${b.address}, ${complaint}, ${b.services || "[]"}, ${s.shopId}
    )`;
  }
  await sql`UPDATE bookings SET status = 'accepted' WHERE id = ${bid}`;
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath("/");
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


