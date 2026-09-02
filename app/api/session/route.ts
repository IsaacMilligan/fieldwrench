import { NextRequest, NextResponse } from "next/server";
import { DEMO, attachSession, signupMechanic, verifyLogin } from "@/lib/auth";
import { ensureReady } from "@/lib/db/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    await ensureReady();
    const form = await req.formData();
    if (String(form.get("signup") ?? "") === "1") {
      const password = String(form.get("password") ?? "");
      const password2 = String(form.get("password2") ?? "");
      if (password !== password2) {
        return NextResponse.redirect(new URL("/login?e=mismatch", origin), 303);
      }
      if (password.length < 8) {
        return NextResponse.redirect(new URL("/login?e=short", origin), 303);
      }
      const made = await signupMechanic({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password,
      });
      if (!made.ok) {
        return NextResponse.redirect(new URL(`/login?e=${made.error}`, origin), 303);
      }
      const res = NextResponse.redirect(new URL("/", origin), 303);
      await attachSession(res, made.session);
      return res;
    }
    const demo = String(form.get("demo") ?? "") === "1";
    const email = demo ? DEMO.email : String(form.get("email") ?? "").trim().toLowerCase();
    const password = demo ? DEMO.password : String(form.get("password") ?? "");
    const ok = await verifyLogin(email, password);
    if (!ok) {
      return NextResponse.redirect(new URL("/login?e=1", origin), 303);
    }
    const res = NextResponse.redirect(new URL("/", origin), 303);
    await attachSession(res, ok);
    return res;
  } catch (e) {
    console.error("session POST", e);
    const msg = e instanceof Error ? e.message : String(e);
    const dbDown = /identify your database|credentials are incorrect|DATABASE_URL|ECONN|timeout|connect/i.test(msg);
    return NextResponse.redirect(new URL(dbDown ? "/login?e=db" : "/login?e=1", origin), 303);
  }
}
