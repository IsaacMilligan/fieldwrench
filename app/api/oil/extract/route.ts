import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  OilShotError,
  extractOilShot,
  prepareOilShot,
  visionNotConfiguredMessage,
  visionProvider,
} from "@/lib/oil-vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "cache-control": "no-store" };

/** Is screenshot import configured? Lets the UI show the "needs <VAR>" message up front. */
export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401, headers: NO_STORE });
  const p = visionProvider();
  return NextResponse.json(
    p ? { configured: true } : { configured: false, error: visionNotConfiguredMessage() },
    { headers: NO_STORE },
  );
}

/**
 * O'Reilly Pro screenshot → extracted oil spec fields for the confirm card.
 * READ-ONLY: never writes to the database. Saving is a separate, user-confirmed step
 * (POST /api/oil/import).
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401, headers: NO_STORE });
  if (!visionProvider()) {
    return NextResponse.json(
      { error: visionNotConfiguredMessage(), code: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 9 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Screenshot is over 8 MB. Crop it to the oil spec section.", code: "too_large" },
      { status: 413, headers: NO_STORE },
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload a screenshot image.", code: "bad_image" }, { status: 400, headers: NO_STORE });
  }
  try {
    const dataUrl = await prepareOilShot(form.get("image"));
    const out = await extractOilShot(dataUrl);
    return NextResponse.json({ ok: true, fields: out.fields, notes: out.notes }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof OilShotError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE });
    }
    console.error("oil_shot extract", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Could not read that screenshot. Type the spec in below.", code: "model_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
