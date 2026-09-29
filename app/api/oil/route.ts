import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getShopSpec } from "@/lib/db/queries";
import { isElectricEngine, isKnownBev } from "@/lib/vpic";
import { lookupOilByYmm, type VehicleFinderOil } from "@/lib/vehicle-finder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OilBody = {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  trim?: string | null;
  vehicleId?: number | string | null;
  bev?: boolean | null;
};

function num(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clean(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function shopOil(spec: {
  oil_viscosity: string;
  oil_qt: number | null;
} | null): { oil: VehicleFinderOil; source: "shop" } | null {
  if (!spec) return null;
  const viscosity = (spec.oil_viscosity ?? "").trim();
  const qtWithFilter = spec.oil_qt != null && spec.oil_qt > 0 ? Number(spec.oil_qt) : null;
  if (!viscosity && qtWithFilter == null) return null;
  return {
    oil: { viscosity, qtWithFilter, qtWithoutFilter: null },
    source: "shop",
  };
}

async function resolve(body: OilBody) {
  const year = num(body.year);
  const make = clean(body.make);
  const model = clean(body.model);
  const engine = clean(body.engine);
  const trim = clean(body.trim);
  const vehicleId = num(body.vehicleId);
  const bev =
    Boolean(body.bev) ||
    isElectricEngine(engine) ||
    (make && model ? isKnownBev(make, model) : false);

  if (!year || year < 1980 || !make || !model) {
    return { status: "none" as const };
  }

  if (bev) return { status: "none" as const };

  // Prefer shop oil when viscosity/qt already saved for this YMM(+engine).
  const shop = await getShopSpec({ year, make, model, engine: engine || undefined }).catch(() => null);
  const fromShop = shopOil(shop);
  if (fromShop) {
    return { status: "same" as const, oil: fromShop.oil, source: fromShop.source };
  }

  // Without engine, also try shop at blank engine key (common shop default).
  if (engine) {
    const shopBlank = await getShopSpec({ year, make, model, engine: "" }).catch(() => null);
    const blank = shopOil(shopBlank);
    if (blank) {
      return { status: "same" as const, oil: blank.oil, source: blank.source };
    }
  }

  return lookupOilByYmm({ year, make, model, engine, trim, vehicleId });
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const result = await resolve({
      year: sp.get("year"),
      make: sp.get("make"),
      model: sp.get("model"),
      engine: sp.get("engine"),
      trim: sp.get("trim"),
      vehicleId: sp.get("vehicleId"),
      bev: sp.get("bev") === "1",
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ status: "none" });
  }
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });

  try {
    const body = (await req.json()) as OilBody;
    const result = await resolve(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ status: "none" });
  }
}
