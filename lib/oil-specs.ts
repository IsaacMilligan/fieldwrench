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

/**
 * Engine displacement in liters, rounded to 1 decimal, or null when the text does not START
 * with one. Accepts a leading number plus an optional "L": "3.7L", "3.7 L V6 gasoline",
 * "5.7L HEMI V8", "3.7", and normalized keys like "3.7lv6". No unit conversion: "370 cu in",
 * "V6", "EV", "Electric" and blank → null (no displacement fallback for those).
 */
export function engineDisplacement(engine: unknown): number | null {
  const t = String(engine ?? "").trim();
  const m = t.match(/^(\d{1,4}(?:\.\d+)?)\s*(l(?=$|[^a-z]|[vih]\d))?\s*(.*)$/i);
  if (!m) return null;
  const hasL = Boolean(m[2]);
  const rest = m[3].trim();
  if (!hasL && rest) return null; // "370 cu in", "2 door" … bare number only when nothing follows
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0.5 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Base model for oil lookup: strips a trailing "Hybrid" / "Plug-in Hybrid" (optionally
 * followed by AWD/FWD/4WD), case-insensitive. "Corolla Hybrid" → "Corolla",
 * "RAV4 Plug-in Hybrid" → "RAV4". Returns the input unchanged when there is no such suffix.
 */
export function oilBaseModel(model: unknown): string {
  return str(model)
    .replace(/\s+(?:plug[\s-]?in\s+)?hybrid(?:\s+(?:awd|fwd|4wd))?$/i, "")
    .trim();
}

/** Row shape needed to pick a verified oil spec (all rows already verified + same shop/year/make). */
export type OilPickRow = {
  model_key: string;
  engine_key: string;
  engine_label?: string | null;
  oil_viscosity?: string | null;
  oil_qt?: number | string | null;
  oil_drain_tq?: number | string | null;
};

function sameOilSpec(a: OilPickRow, b: OilPickRow): boolean {
  return (
    str(a.oil_viscosity).toUpperCase() === str(b.oil_viscosity).toUpperCase() &&
    positiveNum(a.oil_qt) === positiveNum(b.oil_qt) &&
    positiveNum(a.oil_drain_tq) === positiveNum(b.oil_drain_tq)
  );
}

/**
 * Pure verified-spec pick (see getShopOilDefault). `rows` = VERIFIED rows for the shop +
 * year + make, for the given model and/or its base model. For the given model first, then
 * the base model (oilBaseModel) if different:
 * 1. Exact engine_key → "exact".
 * 2. Else, if the engine starts with a displacement: rows with the same displacement. One row,
 *    or several that all share viscosity + capacity + drain torque → "displacement".
 *    Disagreeing specs → no pick (never guess between engines).
 * A blank engine never falls back (only an exact blank-engine row matches).
 */
export function pickVerifiedOilRow<T extends OilPickRow>(
  rows: T[],
  q: { year?: number | null; make?: string | null; model?: string | null; engine?: string | null },
): { row: T; match: "exact" | "displacement" } | null {
  const models = [str(q.model)];
  const base = oilBaseModel(q.model);
  if (base && base.toLowerCase() !== models[0].toLowerCase()) models.push(base);
  const disp = engineDisplacement(q.engine);
  for (const model of models) {
    const key = oilYmmeKey(q.year, q.make, model, q.engine);
    if (!key) continue;
    const mine = rows.filter((r) => r.model_key === key.model_key);
    const exact = mine.find((r) => r.engine_key === key.engine_key);
    if (exact) return { row: exact, match: "exact" };
    if (disp == null) continue;
    const hits = mine.filter((r) => engineDisplacement(r.engine_label || r.engine_key) === disp);
    if (hits.length && hits.every((h) => sameOilSpec(h, hits[0]))) {
      return { row: hits[0], match: "displacement" };
    }
  }
  return null;
}
