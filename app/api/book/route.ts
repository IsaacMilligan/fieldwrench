import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { getCustomerUser } from "@/lib/supabase/server";
import { ensureReady } from "@/lib/db/index";
import { formatServiceList, isServiceId, servicesToJson, type ServiceId } from "@/lib/services";

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
    const services = form
      .getAll("service")
      .map(String)
      .filter(isServiceId) as ServiceId[];
    if (!name || !phone || !services.length || !year || !make || !model || !engine) {
      return NextResponse.redirect(new URL("/book?e=1", origin), 303);
    }
    const user = await getCustomerUser();
    const email = (user?.email ?? String(form.get("email") ?? "")).toLowerCase();
    const issue = formatServiceList(services);
    const vehicle = `${year} ${make} ${model} ${engine}`.trim();
    await sql`INSERT INTO bookings (
      id, name, phone, address, vehicle, vehicle_year, vehicle_make, vehicle_model, vehicle_engine,
      issue, services, notes, preferred_time, status, customer_email
    ) VALUES (
      ${crypto.randomUUID()}, ${name}, ${phone}, ${String(form.get("address") ?? "").trim()}, ${vehicle},
      ${year}, ${make}, ${model}, ${engine},
      ${issue}, ${servicesToJson(services)}, ${notes}, ${String(form.get("preferred_time") ?? "").trim()}, 'pending', ${email}
    )`;
    return NextResponse.redirect(new URL("/book?ok=1", origin), 303);
  } catch (e) {
    console.error("book POST", e);
    return NextResponse.redirect(new URL("/book?e=1", origin), 303);
  }
}
