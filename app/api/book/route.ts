import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/queries";
import { getCustomerUser } from "@/lib/supabase/server";
import { ensureReady } from "@/lib/db/index";

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
    const issue = String(form.get("issue") ?? "").trim();
    if (!name || !phone || !issue) {
      return NextResponse.redirect(new URL("/book?e=1", origin), 303);
    }
    const user = await getCustomerUser();
    const email = (user?.email ?? String(form.get("email") ?? "")).toLowerCase();
    await sql`INSERT INTO bookings (id, name, phone, address, vehicle, issue, preferred_time, status, customer_email) VALUES (
      ${crypto.randomUUID()}, ${name}, ${phone}, ${String(form.get("address") ?? "").trim()}, ${String(form.get("vehicle") ?? "").trim()},
      ${issue}, ${String(form.get("preferred_time") ?? "").trim()}, 'pending', ${email}
    )`;
    return NextResponse.redirect(new URL("/book?ok=1", origin), 303);
  } catch (e) {
    console.error("book POST", e);
    return NextResponse.redirect(new URL("/book?e=1", origin), 303);
  }
}
