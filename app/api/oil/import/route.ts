import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth";
import { oilYmmeKey, positiveNum } from "@/lib/oil-specs";
import { upsertVerifiedOilSpec } from "@/lib/oil-spec-store";
import { isElectricEngine } from "@/lib/vpic";
import { db } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save from the screenshot-import confirm card (only after the user taps Save as verified).
 * Year/make/model/engine come from the record: `vehicleId` (vehicle/job screens) or `specId`
 * (/specs) are resolved server-side in the session's shop. Only create-job with an unsaved
 * vehicle sends year/make/model/engine from the vehicle picker.
 * Writes a VERIFIED oil_defaults row through the same upsert as "Save oil spec".
 * A blank field keeps any value already saved on a verified row for that vehicle.
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const s = (v: unknown, max = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  let veh = {
    year: positiveNum(b.year),
    make: s(b.make),
    model: s(b.model),
    engine: s(b.engine),
  };
  const vehicleId = s(b.vehicleId, 80);
  const specId = s(b.specId, 80);
  if (vehicleId || specId) {
    const sql = await db();
    const [row] = vehicleId
      ? await sql<{ year: number | null; make: string; model: string; engine: string }[]>`
          SELECT year, make, model, engine FROM vehicles WHERE id = ${vehicleId} AND shop_id = ${session.shopId}`
      : await sql<{ year: number | null; make: string; model: string; engine: string }[]>`
          SELECT year, make_label AS make, model_label AS model, engine_label AS engine
          FROM oil_defaults WHERE id = ${specId} AND shop_id = ${session.shopId}`;
    if (!row) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    veh = { year: row.year, make: row.make || "", model: row.model || "", engine: row.engine || "" };
  }
  if (!oilYmmeKey(veh.year, veh.make, veh.model, veh.engine)) {
    return NextResponse.json({ error: "This vehicle needs a year, make, and model first." }, { status: 400 });
  }
  if (isElectricEngine(veh.engine)) {
    return NextResponse.json({ error: "Electric vehicles have no engine oil." }, { status: 400 });
  }
  const vis = s(b.viscosity, 40);
  const qt = positiveNum(b.qtWithFilter);
  const tq = positiveNum(b.drainTq);
  const socketMm = positiveNum(b.socketMm);
  if (!vis && !qt && !tq && !socketMm) {
    return NextResponse.json({ error: "Nothing to save. Fill in at least one oil value." }, { status: 400 });
  }
  try {
    const id = await upsertVerifiedOilSpec(session.shopId, veh, { vis, qt, tq, socketMm }, { keepExisting: true });
    if (!id) return NextResponse.json({ error: "Could not save that spec." }, { status: 400 });
    revalidatePath("/tools");
    revalidatePath("/jobs");
    revalidatePath("/vehicles");
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("oil import save", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save that spec. Try again." }, { status: 500 });
  }
}
