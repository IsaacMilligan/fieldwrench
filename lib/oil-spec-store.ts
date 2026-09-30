import { db } from "@/lib/db/queries";
import { oilYmmeKey } from "@/lib/oil-specs";

export type OilSpecWrite = { vis: string; qt: number | null; tq: number | null; socketMm: number | null };
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
  const [row] = await sql<{ id: string; inserted: boolean }[]>`
    INSERT INTO oil_defaults (
      id, year, make_key, model_key, engine_key, shop_id, make_label, model_label, engine_label, trim,
      oil_qt, oil_viscosity, oil_drain_tq, oil_socket, socket_size_mm, verified, created_at, updated_at
    ) VALUES (
      ${crypto.randomUUID()}, ${key.year}, ${key.make_key}, ${key.model_key}, ${key.engine_key}, ${shop},
      ${veh.make || ""}, ${veh.model || ""}, ${veh.engine || ""}, ${trim},
      ${v.qt}, ${v.vis}, ${v.tq}, ${socketText}, ${v.socketMm}, TRUE, NOW(), NOW()
    )
    ON CONFLICT (shop_id, year, make_key, model_key, engine_key)
    DO UPDATE SET
      oil_qt = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_qt IS NULL
        THEN oil_defaults.oil_qt ELSE EXCLUDED.oil_qt END,
      oil_viscosity = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_viscosity = ''
        THEN oil_defaults.oil_viscosity ELSE EXCLUDED.oil_viscosity END,
      oil_drain_tq = CASE WHEN ${keep}::boolean AND oil_defaults.verified AND EXCLUDED.oil_drain_tq IS NULL
        THEN oil_defaults.oil_drain_tq ELSE EXCLUDED.oil_drain_tq END,
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
