import { db } from "@/lib/db/queries";
import { oilYmmeKey, type ViscosityAlt } from "@/lib/oil-specs";

/** tqNote: undefined = leave the saved note as-is (callers that don't know about it); null/"" clears. */
/** visAlternates: undefined = keep the saved list; [] clears. Callers normalize first.
 *  Written to BOTH columns: grades → oil_viscosity_alternates (TEXT[], still read by older deploys),
 *  {grade,temp} objects → oil_viscosity_alternates_v2 (JSONB). Reads reconcile the two (asSpec). */
/** visTemp: temp range of the preferred grade. undefined = keep; null/"" clears. */
export type OilSpecWrite = {
  vis: string;
  qt: number | null;
  tq: number | null;
  tqNote?: string | null;
  visAlternates?: ViscosityAlt[];
  visTemp?: string | null;
  socketMm: number | null;
};
export type OilSpecSaved = { id: string; inserted: boolean };

/**
 * The one write path for a VERIFIED shop oil spec (exact Y/M/M/engine key).
 * Used by "Save oil spec" on job/vehicle screens and by the O'Reilly screenshot import
 * confirm card. Returns the row id, or null when the vehicle key is incomplete.
 *
 * keepExisting: a blank field keeps the value already saved on a VERIFIED row instead of
 * clearing it (used by screenshot import, where a field the model could not read is blank).
 * Values on an unverified row are never promoted to verified by this.
 *
 * trim: stored in oil_defaults.trim (display only; NOT part of the unique key). Blank keeps
 * whatever trim the row already has.
 */
export async function upsertVerifiedOilSpec(
  shop: string,
  veh: { year: number | null; make: string; model: string; engine: string; trim?: string },
  v: OilSpecWrite,
  opts: { keepExisting?: boolean } = {},
): Promise<OilSpecSaved | null> {
  const key = oilYmmeKey(veh.year, veh.make, veh.model, veh.engine);
  if (!key) return null;
  const sql = await db();
  const socketText = v.socketMm != null ? String(v.socketMm) : "";
  const keep = Boolean(opts.keepExisting);
  const trim = String(veh.trim ?? "").trim();
  const noteGiven = v.tqNote !== undefined;
  const note = v.tqNote ? v.tqNote : null;
  const altsGiven = v.visAlternates !== undefined;
  // Sent as TEXT then cast: a bare `$n::jsonb` param makes postgres.js JSON-encode the string again
  // ("[...]" → a jsonb string scalar → "cannot extract elements from a scalar").
  const altsJson = JSON.stringify((v.visAlternates ?? []).map((a) => ({ grade: a.grade, temp: a.temp ?? null })));
  const tempGiven = v.visTemp !== undefined;
  const temp = v.visTemp ? v.visTemp : null;
  // The row's final preferred grade (same CASE as oil_viscosity below); alternates never repeat it.
  const finalVis = sql`CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_viscosity = ''
          THEN oil_defaults.oil_viscosity ELSE EXCLUDED.oil_viscosity END`;
  const [row] = await sql<{ id: string; inserted: boolean }[]>`
    INSERT INTO oil_defaults (
      id, year, make_key, model_key, engine_key, shop_id, make_label, model_label, engine_label, trim,
      oil_qt, oil_viscosity, oil_drain_tq, oil_drain_tq_note, oil_viscosity_alternates,
      oil_viscosity_alternates_v2, oil_viscosity_temp, oil_socket, socket_size_mm, verified, created_at, updated_at
    ) VALUES (
      ${crypto.randomUUID()}, ${key.year}, ${key.make_key}, ${key.model_key}, ${key.engine_key}, ${shop},
      ${veh.make || ""}, ${veh.model || ""}, ${veh.engine || ""}, ${trim},
      ${v.qt}, ${v.vis}, ${v.tq}, ${note},
      ARRAY(SELECT btrim(e->>'grade') FROM jsonb_array_elements(${altsJson}::text::jsonb) WITH ORDINALITY AS t(e, n)
        WHERE upper(btrim(e->>'grade')) <> upper(btrim(${v.vis}::text)) ORDER BY n),
      (SELECT COALESCE(jsonb_agg(e ORDER BY n), '[]'::jsonb) FROM jsonb_array_elements(${altsJson}::text::jsonb) WITH ORDINALITY AS t(e, n)
        WHERE upper(btrim(e->>'grade')) <> upper(btrim(${v.vis}::text))),
      ${temp},
      ${socketText}, ${v.socketMm}, TRUE, NOW(), NOW()
    )
    ON CONFLICT (shop_id, year, make_key, model_key, engine_key)
    DO UPDATE SET
      oil_qt = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_qt IS NULL
        THEN oil_defaults.oil_qt ELSE EXCLUDED.oil_qt END,
      oil_viscosity = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_viscosity = ''
        THEN oil_defaults.oil_viscosity ELSE EXCLUDED.oil_viscosity END,
      oil_drain_tq = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_drain_tq IS NULL
        THEN oil_defaults.oil_drain_tq ELSE EXCLUDED.oil_drain_tq END,
      oil_drain_tq_note = CASE WHEN NOT ${noteGiven}::boolean
          OR (${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_drain_tq_note IS NULL)
        THEN oil_defaults.oil_drain_tq_note ELSE EXCLUDED.oil_drain_tq_note END,
      -- Given list (or the kept one), minus the row's final preferred grade, in both columns.
      oil_viscosity_alternates = ARRAY(
        SELECT a FROM unnest(CASE WHEN ${altsGiven}::boolean
            THEN EXCLUDED.oil_viscosity_alternates ELSE oil_defaults.oil_viscosity_alternates END)
          WITH ORDINALITY AS t(a, n)
        WHERE upper(btrim(a)) <> upper(btrim(${finalVis}))
        ORDER BY n),
      -- A kept v2 that is NULL (never written) stays NULL; reads rebuild it from text[].
      oil_viscosity_alternates_v2 = CASE
        WHEN NOT ${altsGiven}::boolean AND oil_defaults.oil_viscosity_alternates_v2 IS NULL THEN NULL
        ELSE (SELECT COALESCE(jsonb_agg(e ORDER BY n), '[]'::jsonb)
          FROM jsonb_array_elements(CASE WHEN ${altsGiven}::boolean
              THEN EXCLUDED.oil_viscosity_alternates_v2 ELSE oil_defaults.oil_viscosity_alternates_v2 END)
            WITH ORDINALITY AS t(e, n)
          WHERE upper(btrim(e->>'grade')) <> upper(btrim(${finalVis})))
        END,
      oil_viscosity_temp = CASE WHEN NOT ${tempGiven}::boolean
          OR (${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_viscosity_temp IS NULL)
        THEN oil_defaults.oil_viscosity_temp ELSE EXCLUDED.oil_viscosity_temp END,
      oil_socket = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_socket = ''
        THEN oil_defaults.oil_socket ELSE EXCLUDED.oil_socket END,
      socket_size_mm = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.socket_size_mm IS NULL
        THEN oil_defaults.socket_size_mm ELSE EXCLUDED.socket_size_mm END,
      verified = TRUE,
      make_label = EXCLUDED.make_label,
      model_label = EXCLUDED.model_label,
      engine_label = EXCLUDED.engine_label,
      trim = CASE WHEN EXCLUDED.trim = '' THEN oil_defaults.trim ELSE EXCLUDED.trim END,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
  `;
  return row?.id ? { id: row.id, inserted: row.inserted === true } : null;
}

/**
 * All-blank "Save oil spec": clear every oil value on the row (both alternates columns and both
 * temps included) and un-verify it. The row stays for its trim/body/drive/VIN facts.
 */
export async function clearOilSpec(shop: string, id: string): Promise<void> {
  const sql = await db();
  await sql`UPDATE oil_defaults SET
    oil_qt = NULL, oil_viscosity = '', oil_drain_tq = NULL, oil_drain_tq_note = NULL,
    oil_viscosity_alternates = '{}', oil_viscosity_alternates_v2 = '[]'::jsonb, oil_viscosity_temp = NULL,
    oil_socket = '', socket_size_mm = NULL, verified = FALSE, updated_at = NOW()
    WHERE id = ${id} AND shop_id = ${shop}`;
}
