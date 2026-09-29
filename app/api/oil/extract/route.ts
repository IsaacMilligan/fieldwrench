import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  OIL_SHOT_MAX_IMAGES,
  OilShotError,
  extractOilShots,
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
 * O'Reilly Pro screenshots (multipart, one or more `image` fields; each spec is on its own
 * screen) → extracted oil spec fields, each with its 1-based source image, for the confirm card.
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
  if (len > (OIL_SHOT_MAX_IMAGES * 8 + 1) * 1024 * 1024) {
    return NextResponse.json(
      { error: "Screenshots are too large. Crop them to the spec.", code: "too_large" },
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
    const files = form.getAll("image");
    if (!files.length) throw new OilShotError("Pick or paste a screenshot first.", "bad_image");
    if (files.length > OIL_SHOT_MAX_IMAGES) {
      throw new OilShotError(`Up to ${OIL_SHOT_MAX_IMAGES} screenshots at a time.`, "too_many", 400);
    }
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) urls.push(await prepareOilShot(files[i], i + 1));
    const out = await extractOilShots(urls);
    return NextResponse.json(
      {
        ok: true,
        images: urls.length,
        fields: {
          viscosity: out.viscosity,
          qtWithFilter: out.qtWithFilter,
          drainTq: out.drainTq,
          socketMm: out.socketMm,
        },
        capacityWithoutFilter: out.capacityWithoutFilter,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof OilShotError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE });
    }
    console.error("oil_shot extract", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Could not read those screenshots. Type the spec in.", code: "model_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
