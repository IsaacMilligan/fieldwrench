import { getShopOilDefault, specValues } from "@/lib/db/queries";
import { oilSpecHasAny, type OilSpecValues } from "@/lib/oil-specs";
import { isElectricEngine, isKnownBev } from "@/lib/vpic";

export type ShopOilLookup =
  | { status: "verified"; oil: OilSpecValues; source: "shop" }
  | { status: "none" }
  | { status: "bev" };

/**
 * Verified shop oil spec for an exact Y/M/M/engine, or none. Shop Postgres only —
 * no Vehicle Finder, no external fallback, no engine/first-match guessing.
 */
export async function lookupShopOil(q: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  bev?: boolean | null;
}): Promise<ShopOilLookup> {
  const make = String(q.make ?? "").trim();
  const model = String(q.model ?? "").trim();
  const engine = String(q.engine ?? "").trim();
  if (q.bev || isElectricEngine(engine) || (make && model && isKnownBev(make, model))) {
    return { status: "bev" };
  }
  const spec = await getShopOilDefault({
    year: q.year ?? null,
    make,
    model,
    engine: engine === "__unsure__" ? "" : engine,
  }).catch(() => null);
  const oil = specValues(spec);
  if (!oil || !oilSpecHasAny(oil)) return { status: "none" };
  return { status: "verified", oil, source: "shop" };
}
