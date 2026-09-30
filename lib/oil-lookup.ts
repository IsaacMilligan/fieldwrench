import { getShopOilDefault, specValues, type OilSpecMatch, type ShopSpec } from "@/lib/db/queries";
import { oilSpecHasAny, type OilSpecValues } from "@/lib/oil-specs";
import { isElectricEngine, isKnownBev } from "@/lib/vpic";

export type ShopOilLookup =
  | { status: "verified"; oil: OilSpecValues; source: "shop"; spec: ShopSpec; match: OilSpecMatch }
  | { status: "none" }
  | { status: "bev" };

/**
 * Verified shop oil spec for a Y/M/M/engine, or none: exact key first, then a single
 * same-displacement verified row (see getShopOilDefault). Shop Postgres only — no Vehicle
 * Finder, no external fallback, never picks between several engines.
 * Shared by /api/oil, /api/oil/specs (external read), /api/vin (Tools VIN decode) and applyVin.
 * `shopId` overrides the session shop (bearer-token callers).
 */
export async function lookupShopOil(q: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  bev?: boolean | null;
  shopId?: string | null;
  /** Throw on DB errors instead of reporting "none" (external API: 500, not a misleading 404). */
  throwOnError?: boolean;
}): Promise<ShopOilLookup> {
  const make = String(q.make ?? "").trim();
  const model = String(q.model ?? "").trim();
  const engine = String(q.engine ?? "").trim();
  if (q.bev || isElectricEngine(engine) || (make && model && isKnownBev(make, model))) {
    return { status: "bev" };
  }
  const pending = getShopOilDefault({
    year: q.year ?? null,
    make,
    model,
    engine: engine === "__unsure__" ? "" : engine,
    shopId: q.shopId ?? null,
  });
  const spec = q.throwOnError ? await pending : await pending.catch(() => null);
  const oil = specValues(spec);
  if (!spec || !oil || !oilSpecHasAny(oil)) return { status: "none" };
  return { status: "verified", oil, source: "shop", spec, match: spec.match };
}
