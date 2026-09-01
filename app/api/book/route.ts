import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { getCustomerUser } from "@/lib/supabase/server";
import { ensureReady } from "@/lib/db/index";
import { formatServiceList, isServiceId, servicesToJson, type ServiceId } from "@/lib/services";
import { getSettings } from "@/lib/db/queries";
import { earliestBookDateISO, normalizeLeadHours } from "@/lib/format";

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
    const notes = String(form.get("notes") ?? "").trim();
    const year = Number(String(form.get("vehicle_year") ?? "").trim());
    const make = String(form.get("vehicle_make") ?? "").trim();
    const model = String(form.get("vehicle_model") ?? "").trim();
    const engine = String(form.get("vehicle_engine") ?? "").trim();
    const preferredDate = String(form.get("preferred_date") ?? "").trim();
    const services = form
      .getAll("service")
      .map(String)
      .filter(isServiceId) as ServiceId[];
    const settings = await getSettings().catch(() => ({ lead_hours: 24 }));
    const leadHours = normalizeLeadHours(settings.lead_hours ?? 24);
    const minDate = earliestBookDateISO(leadHours);
    if (!name || !phone || !services.length || !year || !make || !model) {
      return NextResponse.redirect(new URL("/book?e=1", origin), 303);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < minDate) {
      return NextResponse.redirect(new URL("/book?e=lead", origin), 303);
    }
    const user = await getCustomerUser();
    const email = (user?.email ?? String(form.get("email") ?? "")).toLowerCase();
    const issue = formatServiceList(services);
    const engineStored = !engine || engine === "__unsure__" ? "" : engine;
    const vehicle = `${year} ${make} ${model}${engineStored ? ` ${engineStored}` : ""}`.trim();
    await sql`INSERT INTO bookings (
      id, name, phone, address, vehicle, vehicle_year, vehicle_make, vehicle_model, vehicle_engine,
      issue, services, notes, preferred_time, preferred_date, status, customer_email
    ) VALUES (
      ${crypto.randomUUID()}, ${name}, ${phone}, ${String(form.get("address") ?? "").trim()}, ${vehicle},
      ${year}, ${make}, ${model}, ${engineStored},
      ${issue}, ${servicesToJson(services)}, ${notes}, ${""}, ${preferredDate}, 'pending', ${email}
    )`;
    return NextResponse.redirect(new URL("/book?ok=1", origin), 303);
  } catch (e) {
    console.error("book POST", e);
    return NextResponse.redirect(new URL("/book?e=1", origin), 303);
  }
}
