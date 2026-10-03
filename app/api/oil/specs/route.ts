import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { lookupShopOil } from "@/lib/oil-lookup";
import { getShopSpec } from "@/lib/db/queries";
import { oilYmmeKey, parseDrainTqNoteInput } from "@/lib/oil-specs";
import { upsertVerifiedOilSpec } from "@/lib/oil-spec-store";
import { LIVE_SHOP_ID } from "@/lib/shop";
import { isElectricEngine } from "@/lib/vpic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function sha(v: string) {
  return createHash("sha256").update(v).digest();
}

/**
 * Who is asking, and for which shop.
 * - In-app: the normal fw_session cookie (shop from the session).
 * - External (e.g. the VIN decoder app, server-side): `Authorization: Bearer <OIL_SPECS_READ_TOKEN>`,
 *   scoped to the one shop in OIL_SPECS_READ_SHOP_ID. Token auth is off unless BOTH are set.
 */
async function resolveShop(req: NextRequest): Promise<{ shopId: string } | { error: string; status: number }> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const want = String(process.env.OIL_SPECS_READ_TOKEN ?? "").trim();
    const shop = String(process.env.OIL_SPECS_READ_SHOP_ID ?? "").trim();
    if (!want || !shop) return { error: "Token access is not enabled.", status: 401 };
    if (!timingSafeEqual(sha(m[1].trim()), sha(want))) return { error: "Invalid token.", status: 401 };
    return { shopId: shop };
  }
  const session = await readSession();
  if (!session) return { error: "Login required.", status: 401 };
  return { shopId: session.shopId };
}

/**
 * GET /api/oil/specs?year=&make=&model=&engine=
 * Read-only. Verified shop oil spec: exact normalized key first (match "exact"); else the ONE
 * verified row for that year/make/model with the same engine displacement (match
 * "displacement"); otherwise 404. Never picks between several engines.
 */
export async function GET(req: NextRequest) {
  const who = await resolveShop(req);
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status, headers: NO_STORE });

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const make = String(sp.get("make") ?? "").trim();
  const model = String(sp.get("model") ?? "").trim();
  const engine = String(sp.get("engine") ?? "").trim();
  if (!Number.isInteger(year) || year < 1980 || !make || !model) {
    return NextResponse.json(
      { error: "year (1980+), make, and model are required. engine is optional but must match exactly." },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const r = await lookupShopOil({ year, make, model, engine, bev: sp.get("bev") === "1", shopId: who.shopId, throwOnError: true });
    if (r.status === "bev") return NextResponse.json({ status: "bev", oil: null }, { headers: NO_STORE });
    if (r.status !== "verified") return NextResponse.json({ status: "none" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(
      {
        status: "verified",
        source: "shop",
        match: r.match,
        vehicle: {
          year: r.spec.year,
          make: r.spec.make_label,
          model: r.spec.model_label,
          engine: r.spec.engine_label,
        },
        oil: {
          viscosity: r.oil.viscosity || null,
          qtWithFilter: r.oil.qtWithFilter,
          drainTqFtLb: r.oil.drainTq,
          drainTqNote: r.oil.drainTqNote ?? null,
          socketMm: r.oil.socketMm,
        },
        verified: true,
        updatedAt: r.spec.updated_at,
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("oil specs read", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500, headers: NO_STORE });
  }
}

/** Constant-time bearer check against OIL_SPEC_BOT_TOKEN. Unset token → nobody gets in. */
function botAuthorized(req: Request): boolean {
  const want = String(process.env.OIL_SPEC_BOT_TOKEN ?? "").trim();
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!want || !m) return false;
  return timingSafeEqual(sha(m[1].trim()), sha(want));
}

type Bad = { error: string };

function text(v: unknown, field: string, max: number, required = false): string | Bad {
  if (v == null) return required ? { error: `${field} is required.` } : "";
  if (typeof v !== "string" && typeof v !== "number") return { error: `${field} must be a string.` };
  const t = String(v).replace(/\s+/g, " ").trim();
  if (required && !t) return { error: `${field} is required.` };
  if (t.length > max) return { error: `${field} is too long (max ${max}).` };
  return t;
}

/** null/"" → null (stays blank). Otherwise a plain number inside [lo, hi] or a 400. */
function num(v: unknown, field: string, lo: number, hi: number): number | null | Bad {
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  const n = typeof v === "number" ? v : /^\s*\d+(\.\d+)?\s*$/.test(String(v)) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return { error: `${field} must be a number.` };
  if (n < lo || n > hi) return { error: `${field} must be between ${lo} and ${hi}.` };
  return n;
}

function isBad(v: unknown): v is Bad {
  return Boolean(v && typeof v === "object" && "error" in (v as object));
}

/**
 * POST /api/oil/specs — bot write of a VERIFIED oil spec into the LIVE shop (Isaac's real shop).
 * Auth: Authorization: Bearer <OIL_SPEC_BOT_TOKEN> only (session cookies are NOT accepted here).
 * Same normalized key + same upsert as "Save oil spec": posting the same vehicle again updates
 * that row (200); a new vehicle creates one (201). Blank/null oil fields are saved blank.
 * oil_drain_tq_note (optional string, ≤200): free-text torque for two-plug engines. Omit the key to
 * keep the saved note; null/"" clears it. oil_drain_tq stays a number (or omitted/null).
 */
export async function POST(req: NextRequest) {
  if (!botAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400, headers: NO_STORE });
  }
  const maxYear = new Date().getFullYear() + 2;
  const yearRaw = body.year;
  const year = typeof yearRaw === "number" ? yearRaw : /^\s*\d{4}\s*$/.test(String(yearRaw ?? "")) ? Number(yearRaw) : NaN;
  const make = text(body.make, "make", 40, true);
  const model = text(body.model, "model", 60, true);
  const engine = text(body.engine, "engine", 60);
  const trim = text(body.trim, "trim", 60);
  const visRaw = text(body.oil_viscosity, "oil_viscosity", 20);
  const qt = num(body.oil_qt, "oil_qt", 0.5, 20);
  const tq = num(body.oil_drain_tq, "oil_drain_tq", 5, 100);
  const socket = num(body.socket_size_mm, "socket_size_mm", 6, 36);
  // Optional free-text torque (two drain plugs etc.). Key absent → keep the saved note; null/"" → clear.
  const noteIn = parseDrainTqNoteInput("oil_drain_tq_note" in body ? body.oil_drain_tq_note : undefined);
  const errors: string[] = [];
  if (!Number.isInteger(year) || year < 1980 || year > maxYear) errors.push(`year must be 1980–${maxYear}.`);
  for (const v of [make, model, engine, trim, visRaw, qt, tq, socket, noteIn]) if (isBad(v)) errors.push(v.error);
  const tqNote = "note" in noteIn ? noteIn.note : undefined;
  let vis = "";
  if (!isBad(visRaw) && visRaw) {
    const m = visRaw.toUpperCase().replace(/^SAE\s*/, "").match(/^(\d{1,2})\s*W\s*-?\s*(\d{1,2})$/);
    if (m) vis = `${Number(m[1])}W-${Number(m[2])}`;
    else errors.push('oil_viscosity must look like "5W-30".');
  }
  if (!isBad(engine) && isElectricEngine(engine)) errors.push("Electric vehicles have no engine oil.");
  if (!errors.length && !vis && qt == null && tq == null && !tqNote && socket == null) {
    errors.push("Send at least one of oil_viscosity, oil_qt, oil_drain_tq, oil_drain_tq_note, socket_size_mm.");
  }
  if (errors.length) return NextResponse.json({ error: errors.join(" "), errors }, { status: 400, headers: NO_STORE });

  const veh = {
    year,
    make: make as string,
    model: model as string,
    engine: engine as string,
    trim: trim as string,
  };
  const key = oilYmmeKey(veh.year, veh.make, veh.model, veh.engine);
  if (!key) return NextResponse.json({ error: "year, make, and model are required." }, { status: 400, headers: NO_STORE });
  try {
    const saved = await upsertVerifiedOilSpec(LIVE_SHOP_ID, veh, {
      vis,
      qt: qt as number | null,
      tq: tq as number | null,
      tqNote,
      socketMm: socket as number | null,
    });
    const spec = saved ? await getShopSpec({ ...veh, shopId: LIVE_SHOP_ID }) : null;
    if (!saved || !spec) throw new Error("upsert returned nothing");
    return NextResponse.json(
      {
        status: saved.inserted ? "created" : "updated",
        shop_id: LIVE_SHOP_ID,
        key: { shop_id: LIVE_SHOP_ID, ...key },
        spec: {
          id: spec.id,
          year: spec.year,
          make: spec.make_label,
          model: spec.model_label,
          engine: spec.engine_label,
          trim: spec.trim,
          oil_viscosity: spec.oil_viscosity || null,
          oil_qt: spec.oil_qt,
          oil_drain_tq: spec.oil_drain_tq,
          oil_drain_tq_note: spec.oil_drain_tq_note,
          socket_size_mm: spec.socket_mm,
          verified: spec.verified,
          updated_at: spec.updated_at,
        },
      },
      { status: saved.inserted ? 201 : 200, headers: NO_STORE },
    );
  } catch (e) {
    console.error("oil specs bot write", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Save failed." }, { status: 500, headers: NO_STORE });
  }
}
