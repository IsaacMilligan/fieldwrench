/**
 * Shop-owned oil specs. The source of truth is the shop Postgres table `oil_defaults`
 * (keyed by shop + year/make/model/engine). No third-party oil lookups: if the shop
 * has not saved a verified spec for a vehicle, the fields stay blank.
 */

/** O'Reilly Pro has no public/documented vehicle deep link (login-gated), so link to the pro home. */
export const OREILLY_PRO_URL = "https://www.oreillypro.com/";

function str(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

export function formatQt(n: number): string {
  const t = Number.isInteger(n) ? n.toFixed(1) : String(n);
  return `${t} qt`;
}

/** Positive number or null. Accepts "14", "14mm", "14 mm". */
export function positiveNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Number(n));
}

/** Oil spec fields shown on job/vehicle screens. Socket is optional. */
export type OilSpecValues = {
  viscosity: string;
  qtWithFilter: number | null;
  drainTq: number | null;
  socketMm: number | null;
};

export function oilSpecHasAny(v: OilSpecValues | null | undefined): boolean {
  return Boolean(v && (v.viscosity || v.qtWithFilter || v.drainTq || v.socketMm));
}

/** Complete = viscosity + capacity + drain plug torque. Socket is optional. */
export function oilSpecComplete(v: OilSpecValues | null | undefined): boolean {
  return Boolean(v && v.viscosity && v.qtWithFilter && v.drainTq);
}

/**
 * Normalized key for a vehicle's oil spec. Case/whitespace-insensitive; exact match only
 * (no first-match, no engine fallback). Year + make + model required.
 */
export function oilYmmeKey(
  year?: number | null,
  make?: string | null,
  model?: string | null,
  engine?: string | null,
): { year: number; make_key: string; model_key: string; engine_key: string } | null {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1980) return null;
  const make_key = str(make).toLowerCase();
  const model_key = str(model).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!make_key || !model_key) return null;
  return {
    year: y,
    make_key,
    model_key,
    engine_key: str(engine).toLowerCase().replace(/[^a-z0-9.]/g, ""),
  };
}
