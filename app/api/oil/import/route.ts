import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth";
import { oilYmmeKey, positiveNum } from "@/lib/oil-specs";
import { upsertVerifiedOilSpec } from "@/lib/oil-spec-store";
import { isElectricEngine } from "@/lib/vpic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save from the screenshot-import confirm card (only after the user taps Save).
 * Writes a VERIFIED oil_defaults row through the same upsert as "Save oil spec".
 * A blank field keeps any value already saved on a verified row for that vehicle.
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const s = (v: unknown, max = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const veh = {
    year: positiveNum(b.year),
    make: s(b.make),
    model: s(b.model),
    engine: s(b.engine),
  };
  if (!oilYmmeKey(veh.year, veh.make, veh.model, veh.engine)) {
    return NextResponse.json({ error: "Year, make, and model are required." }, { status: 400 });
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
