/**
 * Shop-owned oil specs. The source of truth is the shop Postgres table `oil_defaults`
 * (keyed by shop + year/make/model/engine). No third-party oil lookups: if the shop
 * has not saved a verified spec for a vehicle, the fields stay blank.
 */

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
  /** Free-text drain plug torque (e.g. two plugs: "18 ft-lb (13 mm plug) / 62 ft-lb (16 mm plug)"). */
  drainTqNote?: string | null;
  socketMm: number | null;
  /** Temperature range for the preferred grade ("above 0°F"), null when none. */
  viscosityTemp?: string | null;
  /** Other acceptable grades with optional temps ([] / undefined when none). */
  viscosityAlternates?: ViscosityAlt[];
};

export const DRAIN_TQ_NOTE_MAX = 200;

/** Drain torque note: whitespace collapsed + trimmed, "" → null. Length is checked by callers. */
export function cleanDrainTqNote(v: unknown): string | null {
  return str(v) || null;
}

/**
 * API input for oil_drain_tq_note: `undefined` (key omitted) → keep the saved note; null/"" → clear (null);
 * a string → cleaned note; anything else (number, boolean, object, array) or > DRAIN_TQ_NOTE_MAX → error.
 */
export function parseDrainTqNoteInput(v: unknown): { note: string | null | undefined } | { error: string } {
  if (v === undefined) return { note: undefined };
  if (v === null) return { note: null };
  if (typeof v !== "string") return { error: "oil_drain_tq_note must be text." };
  const note = cleanDrainTqNote(v);
  if (note && note.length > DRAIN_TQ_NOTE_MAX) return { error: `oil_drain_tq_note is too long (max ${DRAIN_TQ_NOTE_MAX}).` };
  return { note };
}

export const VISC_ALT_MAX_ITEMS = 10;
export const VISC_ALT_MAX_LEN = 20;
/** Free-text temperature range for a grade ("above 0°F", "-20°F to 100°F"). */
export const VISC_TEMP_MAX = 40;

/** One other acceptable grade, with an optional temperature range (null = none given). */
export type ViscosityAlt = { grade: string; temp: string | null };

/** Temperature range text: whitespace collapsed + trimmed, "" → null. Length is checked by callers. */
export function cleanViscosityTemp(v: unknown): string | null {
  return str(v) || null;
}

/**
 * Viscosity alternates for storage: grades trimmed, blank grades dropped, case-insensitive duplicate
 * grades dropped (first one kept, with its temp), and any grade equal to the preferred
 * `oil_viscosity` dropped. Plain strings become { grade, temp: null }.
 */
export function normalizeViscosityAlternates(
  list: readonly (string | { grade: string; temp?: string | null })[],
  preferred: string | null | undefined,
): ViscosityAlt[] {
  const pref = String(preferred ?? "").trim().toUpperCase();
  const seen = new Set<string>();
  const out: ViscosityAlt[] = [];
  for (const raw of list) {
    const grade = String(typeof raw === "string" ? raw : raw?.grade ?? "").trim();
    const k = grade.toUpperCase();
    if (!grade || k === pref || seen.has(k)) continue;
    seen.add(k);
    out.push({ grade, temp: typeof raw === "string" ? null : cleanViscosityTemp(raw.temp) });
  }
  return out;
}

const ALT_ITEM_ERR = "oil_viscosity_alternates items must be a grade string or {grade, temp}.";

/**
 * API input for oil_viscosity_alternates: `undefined` (key omitted) → keep the saved list;
 * null or [] → clear ([]); an array whose items are each a string or { grade: string, temp?: string|null }
 * (mixed is fine) → normalized list (see normalizeViscosityAlternates). Anything else, an object without
 * a non-blank string grade, a non-text temp, a grade over VISC_ALT_MAX_LEN, a temp over VISC_TEMP_MAX,
 * or more than VISC_ALT_MAX_ITEMS after normalizing → error.
 */
export function parseViscosityAlternatesInput(
  v: unknown,
  preferred: string | null | undefined,
): { alternates: ViscosityAlt[] | undefined } | { error: string } {
  if (v === undefined) return { alternates: undefined };
  if (v === null) return { alternates: [] };
  if (!Array.isArray(v)) return { error: "oil_viscosity_alternates must be an array." };
  const items: (string | { grade: string; temp: string | null })[] = [];
  for (const x of v as unknown[]) {
    if (typeof x === "string") {
      items.push(x);
      continue;
    }
    if (!x || typeof x !== "object" || Array.isArray(x)) return { error: ALT_ITEM_ERR };
    const o = x as Record<string, unknown>;
    if (typeof o.grade !== "string" || !o.grade.trim()) return { error: ALT_ITEM_ERR };
    if (o.temp !== undefined && o.temp !== null && typeof o.temp !== "string") {
      return { error: "oil_viscosity_alternates temp must be text." };
    }
    const temp = cleanViscosityTemp(o.temp);
    if (temp && temp.length > VISC_TEMP_MAX) {
      return { error: `oil_viscosity_alternates temp is too long (max ${VISC_TEMP_MAX}).` };
    }
    items.push({ grade: o.grade, temp });
  }
  if (items.some((x) => (typeof x === "string" ? x : x.grade).trim().length > VISC_ALT_MAX_LEN)) {
    return { error: `oil_viscosity_alternates grades must be at most ${VISC_ALT_MAX_LEN} characters.` };
  }
  const alternates = normalizeViscosityAlternates(items, preferred);
  if (alternates.length > VISC_ALT_MAX_ITEMS) {
    return { error: `oil_viscosity_alternates can have at most ${VISC_ALT_MAX_ITEMS} items.` };
  }
  return { alternates };
}

/**
 * API input for oil_viscosity_temp (temperature range of the preferred grade): `undefined` → keep;
 * null/"" → clear (null); a string → cleaned; anything else or > VISC_TEMP_MAX → error.
 */
export function parseViscosityTempInput(v: unknown): { temp: string | null | undefined } | { error: string } {
  if (v === undefined) return { temp: undefined };
  if (v === null) return { temp: null };
  if (typeof v !== "string") return { error: "oil_viscosity_temp must be text." };
  const temp = cleanViscosityTemp(v);
  if (temp && temp.length > VISC_TEMP_MAX) return { error: `oil_viscosity_temp is too long (max ${VISC_TEMP_MAX}).` };
  return { temp };
}

/** Stored text[] → clean string array ([] when missing). */
export function viscosityAlternatesOf(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

/** Stored jsonb list → clean objects (null when the column is NULL / not an array). Tolerates strings. */
function viscosityAltObjectsOf(v: unknown): ViscosityAlt[] | null {
  if (!Array.isArray(v)) return null;
  const out: ViscosityAlt[] = [];
  for (const x of v as unknown[]) {
    if (typeof x === "string") {
      if (x.trim()) out.push({ grade: x.trim(), temp: null });
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const grade = String(o.grade ?? "").trim();
      if (grade) out.push({ grade, temp: typeof o.temp === "string" ? cleanViscosityTemp(o.temp) : null });
    }
  }
  return out;
}

/**
 * Read-side reconcile of the two alternates columns. The legacy text[] (`oil_viscosity_alternates`)
 * is still written by older deployments, so it decides WHICH grades and their order; the jsonb
 * `oil_viscosity_alternates_v2` only supplies temps. If v2 is NULL or its case-insensitive grade set
 * differs from text[], the list is rebuilt from text[] (in text[] order) with temps carried over
 * from v2 for matching grades and null otherwise. When the sets match, v2 is used as is.
 */
export function reconcileViscosityAlternates(textArr: unknown, v2: unknown): ViscosityAlt[] {
  const grades = viscosityAlternatesOf(textArr);
  const objs = viscosityAltObjectsOf(v2);
  const keys = (l: string[]) => [...new Set(l.map((g) => g.toUpperCase()))].sort().join("\u0000");
  if (objs && keys(objs.map((o) => o.grade)) === keys(grades) && objs.length === new Set(objs.map((o) => o.grade.toUpperCase())).size) {
    return objs;
  }
  const temps = new Map<string, string | null>();
  for (const o of objs ?? []) if (!temps.has(o.grade.toUpperCase())) temps.set(o.grade.toUpperCase(), o.temp);
  const seen = new Set<string>();
  const out: ViscosityAlt[] = [];
  for (const g of grades) {
    const k = g.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ grade: g, temp: temps.get(k) ?? null });
  }
  return out;
}

/** "0W-20 · above 0°F" (just the grade when there is no temp; "" when no grade). */
export function viscosityWithTemp(vis: string | null | undefined, temp: string | null | undefined): string {
  const v = str(vis);
  const t = cleanViscosityTemp(temp);
  return v && t ? `${v} · ${t}` : v;
}

/** "10W-30 (above 0°F), 5W-30" ("" when none). */
export function viscosityAlternatesText(alts: readonly ViscosityAlt[] | null | undefined): string {
  return (alts ?? []).map((a) => (a.temp ? `${a.grade} (${a.temp})` : a.grade)).join(", ");
}

/**
 * "Save oil spec" form fields (job / vehicle / spec screens). A submitted blank note is null
 * (= clear); only a form WITHOUT the note field gives undefined (= keep). `blank` = every field empty.
 */
export function oilSpecFormInput(form: { get(name: string): unknown; has(name: string): boolean }) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const vis = s("oil_viscosity").replace(/\s+/g, " ");
  const qt = positiveNum(s("oil_qt"));
  const tq = positiveNum(s("oil_drain_tq"));
  const socketMm = positiveNum(s("oil_socket"));
  const tqNote = form.has("oil_drain_tq_note") ? cleanDrainTqNote(s("oil_drain_tq_note").slice(0, DRAIN_TQ_NOTE_MAX)) : undefined;
  // Same rule for the preferred grade's temp range: field absent → keep, blank → clear.
  const visTemp = form.has("oil_viscosity_temp") ? cleanViscosityTemp(s("oil_viscosity_temp").slice(0, VISC_TEMP_MAX)) : undefined;
  return {
    vis, qt, tq, tqNote, visTemp, socketMm,
    blank: !vis && qt == null && tq == null && !tqNote && !visTemp && socketMm == null,
  };
}

/** Drain plug torque for display: the note when present, else "N ft-lb", else "". */
export function drainTqText(v: Pick<OilSpecValues, "drainTq" | "drainTqNote"> | null | undefined): string {
  const note = cleanDrainTqNote(v?.drainTqNote);
  if (note) return note;
  return v?.drainTq ? `${formatNum(v.drainTq)} ft-lb` : "";
}

export function oilSpecHasAny(v: OilSpecValues | null | undefined): boolean {
  return Boolean(v && (v.viscosity || v.qtWithFilter || v.drainTq || v.drainTqNote || v.socketMm));
}

/** Complete = viscosity + capacity + drain plug torque (number or note). Socket is optional. */
export function oilSpecComplete(v: OilSpecValues | null | undefined): boolean {
  return Boolean(v && v.viscosity && v.qtWithFilter && (v.drainTq || v.drainTqNote));
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
  oil_drain_tq_note?: string | null;
};

function sameOilSpec(a: OilPickRow, b: OilPickRow): boolean {
  return (
    str(a.oil_viscosity).toUpperCase() === str(b.oil_viscosity).toUpperCase() &&
    positiveNum(a.oil_qt) === positiveNum(b.oil_qt) &&
    positiveNum(a.oil_drain_tq) === positiveNum(b.oil_drain_tq) &&
    cleanDrainTqNote(a.oil_drain_tq_note) === cleanDrainTqNote(b.oil_drain_tq_note)
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
