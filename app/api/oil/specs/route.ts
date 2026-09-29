import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { lookupShopOil } from "@/lib/oil-lookup";

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
 * Read-only. Verified shop oil spec for the EXACT normalized year/make/model/engine
 * (same key as oil_defaults), or 404. Never guesses, never falls back to another engine.
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
