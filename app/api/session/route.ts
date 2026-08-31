import { NextRequest, NextResponse } from "next/server";
import { DEMO, attachSession, verifyLogin } from "@/lib/auth";
import { ensureReady } from "@/lib/db/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    await ensureReady();
    const form = await req.formData();
    const demo = String(form.get("demo") ?? "") === "1";
    const email = demo ? DEMO.email : String(form.get("email") ?? "").trim().toLowerCase();
    const password = demo ? DEMO.password : String(form.get("password") ?? "");
    const ok = await verifyLogin(email, password);
    if (!ok) {
      return NextResponse.redirect(new URL("/login?e=1", origin), 303);
    }
    const res = NextResponse.redirect(new URL("/", origin), 303);
    await attachSession(res, email);
    return res;
  } catch (e) {
    console.error("session POST", e);
    return NextResponse.redirect(new URL("/login?e=1", origin), 303);
  }
}
