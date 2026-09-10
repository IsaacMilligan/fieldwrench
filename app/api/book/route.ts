import { NextRequest, NextResponse } from "next/server";
import { db, getSettings, listDayLoads, listBookableServices } from "@/lib/db/queries";
import { getCustomerUser } from "@/lib/supabase/server";
import { ensureReady } from "@/lib/db/index";
import { servicesToJson } from "@/lib/services";
import { durationsFromBookable, labelsFromBookable } from "@/lib/bookable-services";
import { bookingShopId } from "@/lib/auth";
import { earliestBookDateISO, normalizeLeadHours } from "@/lib/format";
import { geocodeAddress } from "@/lib/geocode";
import {
  DEFAULT_BUFFER_MIN,
  DEFAULT_HOME_COORDS,
  DEFAULT_HOURS,
  DEFAULT_RADIUS_MI,
  DEFAULT_SLOT_STEP,
  bookingDurationMinutes,
  haversineMiles,
  isShopOpenOn,
  isValidStartTime,
  maxJobsOnDay,
  parseHours,
  clampSlotStep,
} from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    await ensureReady();
    const sql = await db();
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const year = Number(String(form.get("vehicle_year") ?? "").trim());
    const make = String(form.get("vehicle_make") ?? "").trim();
    const model = String(form.get("vehicle_model") ?? "").trim();
    const engine = String(form.get("vehicle_engine") ?? "").trim();
    const preferredDate = String(form.get("preferred_date") ?? "").trim();
    const preferredTime = String(form.get("preferred_time") ?? "").trim();
    const requested = form.getAll("service").map(String).filter(Boolean);
    const catalog = await listBookableServices({ activeOnly: true }).catch(() => []);
    const allowed = new Set(catalog.map((s) => s.id));
    const services = requested.filter((id) => allowed.has(id));
    if (!services.length || services.length !== requested.length) {
      return NextResponse.redirect(new URL("/book?e=1", origin), 303);
    }
    const settings = await getSettings().catch(() => ({
      lead_hours: 24,
      hours: DEFAULT_HOURS,
      job_buffer_min: DEFAULT_BUFFER_MIN,
      service_radius_mi: DEFAULT_RADIUS_MI,
      home_lat: null as number | null,
      home_lng: null as number | null,
      home_base: "",
      slot_step_min: DEFAULT_SLOT_STEP,
    }));
    const leadHours = normalizeLeadHours(settings.lead_hours ?? 24);
    const minDate = earliestBookDateISO(leadHours);
    const hours = parseHours(settings.hours ?? DEFAULT_HOURS);
    const buffer = Number(settings.job_buffer_min) || DEFAULT_BUFFER_MIN;
    const radius = Number(settings.service_radius_mi) || DEFAULT_RADIUS_MI;
    const durations = durationsFromBookable(catalog);
    const slotStep = clampSlotStep(settings.slot_step_min ?? DEFAULT_SLOT_STEP);
    const durationMin = bookingDurationMinutes(services, durations);
    if (!name || !phone || !address || !services.length || !year || !make || !model) {
      return NextResponse.redirect(new URL("/book?e=1", origin), 303);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < minDate) {
      return NextResponse.redirect(new URL("/book?e=lead", origin), 303);
    }
    if (!isShopOpenOn(hours, preferredDate)) {
      return NextResponse.redirect(new URL("/book?e=closed", origin), 303);
    }
    if (!isValidStartTime(hours, preferredDate, preferredTime, durationMin, slotStep)) {
      return NextResponse.redirect(new URL("/book?e=time", origin), 303);
    }
    const loads = await listDayLoads(minDate).catch(() => new Map<string, number>());
    const cap = maxJobsOnDay(hours, preferredDate, buffer);
    if ((loads.get(preferredDate) ?? 0) >= cap) {
      return NextResponse.redirect(new URL("/book?e=full", origin), 303);
    }
    let home = {
      lat: settings.home_lat,
      lng: settings.home_lng,
    };
    if (home.lat == null || home.lng == null) {
      const g = await geocodeAddress(String(settings.home_base || ""));
      if (g) home = g;
      else home = DEFAULT_HOME_COORDS;
    }
    const pickedLat = Number(String(form.get("address_lat") ?? ""));
    const pickedLng = Number(String(form.get("address_lng") ?? ""));
    let dest =
      Number.isFinite(pickedLat) && Number.isFinite(pickedLng) && pickedLat !== 0
        ? { lat: pickedLat, lng: pickedLng }
        : await geocodeAddress(address);
    if (home.lat != null && home.lng != null && dest) {
      const miles = haversineMiles({ lat: Number(home.lat), lng: Number(home.lng) }, dest);
      if (miles > radius + 0.05) {
        return NextResponse.redirect(new URL("/book?e=area", origin), 303);
      }
    }
    const user = await getCustomerUser();
    const email = (user?.email ?? String(form.get("email") ?? "")).toLowerCase();
    const issue = labelsFromBookable(services, catalog);
    const engineStored = !engine || engine === "__unsure__" ? "" : engine;
    const vehicle = `${year} ${make} ${model}${engineStored ? ` ${engineStored}` : ""}`.trim();
    const shopId = await bookingShopId();
    await sql`INSERT INTO bookings (
      id, name, phone, address, vehicle, vehicle_year, vehicle_make, vehicle_model, vehicle_engine,
      issue, services, notes, preferred_time, preferred_date, duration_minutes, status, customer_email, shop_id
    ) VALUES (
      ${crypto.randomUUID()}, ${name}, ${phone}, ${address}, ${vehicle},
      ${year}, ${make}, ${model}, ${engineStored},
      ${issue}, ${servicesToJson(services)}, ${notes}, ${preferredTime}, ${preferredDate}, ${durationMin}, 'pending', ${email}, ${shopId}
    )`;
    return NextResponse.redirect(new URL("/book?ok=1", origin), 303);
  } catch (e) {
    console.error("book POST", e);
    return NextResponse.redirect(new URL("/book?e=1", origin), 303);
  }
}
