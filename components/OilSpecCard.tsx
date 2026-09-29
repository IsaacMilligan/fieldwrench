import { formatNum, formatQt, oilSpecComplete, oilSpecHasAny, type OilSpecValues } from "@/lib/oil-specs";
import { isElectricEngine } from "@/lib/vpic";
import { OReillyProButton } from "@/components/OReillyProButton";
import { OilScreenshotImport } from "@/components/OilScreenshotImport";

/**
 * Engine oil card for job / vehicle / shop-spec screens.
 * Auto-fills ONLY from a verified shop spec (exact year/make/model/engine). No spec → blank.
 * Saving writes a verified shop spec for that vehicle.
 */
export function OilSpecCard({
  vehicleId,
  specId,
  spec,
  verified = true,
  compact = false,
  next,
  engine,
  vehicle,
}: {
  vehicleId?: string;
  specId?: string;
  /** Verified shop spec values (or the spec row being edited on /specs). */
  spec?: OilSpecValues | null;
  /** Only relevant on /specs: an older row that nobody has verified yet. */
  verified?: boolean;
  compact?: boolean;
  next?: string;
  engine?: string | null;
  /** Year/make/model/engine this card is for; enables "Add from O'Reilly screenshot". */
  vehicle?: { year?: number | null; make?: string | null; model?: string | null; engine?: string | null } | null;
}) {
  if (isElectricEngine(engine)) {
    return (
      <section className={compact ? "mt-3 panel" : "mt-6 panel"}>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
          Engine oil
        </h2>
        <div className="num mt-3 text-4xl text-amber">N/A</div>
        <p className="mt-2 text-sm text-muted">No engine oil and no drain plug.</p>
      </section>
    );
  }

  const v: OilSpecValues = {
    viscosity: String(spec?.viscosity ?? "").trim(),
    qtWithFilter: spec?.qtWithFilter ?? null,
    drainTq: spec?.drainTq ?? null,
    socketMm: spec?.socketMm ?? null,
  };
  const has = oilSpecHasAny(v);
  const complete = oilSpecComplete(v);
  const badge = has ? (verified ? "Verified" : "Not verified") : "";

  return (
    <section className={compact ? "mt-3 panel" : "mt-6 panel"}>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Engine oil
      </h2>
      {has ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="num text-4xl">{v.viscosity || "—"}</div>
            <span
              className={`text-xs font-bold uppercase tracking-widest ${verified ? "text-green" : "text-amber"}`}
            >
              {badge}
            </span>
          </div>
          <div className="num mt-2 text-3xl text-amber">
            {v.qtWithFilter ? `${formatQt(v.qtWithFilter)} with filter` : "—"}
          </div>
          {v.drainTq || v.socketMm ? (
            <p className="mt-2 text-sm text-muted">
              Drain plug
              {v.drainTq ? ` ${formatNum(v.drainTq)} ft-lb` : ""}
              {v.socketMm ? ` · ${formatNum(v.socketMm)} mm socket` : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-lg font-bold text-amber">No oil spec on file</p>
      )}
      {!complete ? (
        <>
          <p className="mt-2 text-sm text-muted">
            {has ? "Spec is missing a value." : "Look it up once, save it here."} Saved specs fill in for every car
            with this year, make, model, and engine.
          </p>
          <OReillyProButton className="mt-3" />
        </>
      ) : null}
      {vehicle && (vehicleId || specId) ? (
        <OilScreenshotImport
          className="mt-3"
          year={vehicle.year}
          make={vehicle.make}
          model={vehicle.model}
          engine={vehicle.engine}
        />
      ) : null}
      {vehicleId || specId ? (
        <form action="/api/shop" method="post" className="mt-4">
          <input type="hidden" name="_op" value="save_oil_spec" />
          {vehicleId ? <input type="hidden" name="id" value={vehicleId} /> : null}
          {specId ? <input type="hidden" name="spec_id" value={specId} /> : null}
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label className="lbl">Viscosity</label>
          <input
            className="field"
            name="oil_viscosity"
            defaultValue={v.viscosity}
            placeholder="0W-20"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <label className="lbl">Capacity (qt w/ filter)</label>
          <input
            className="field"
            name="oil_qt"
            inputMode="decimal"
            defaultValue={formatNum(v.qtWithFilter)}
            placeholder="qt"
            autoComplete="off"
          />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="lbl">Drain plug torque (ft-lb)</label>
              <input
                className="field"
                name="oil_drain_tq"
                inputMode="decimal"
                defaultValue={formatNum(v.drainTq)}
                placeholder="ft-lb"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="lbl">Socket (mm, optional)</label>
              <input
                className="field"
                name="oil_socket"
                inputMode="decimal"
                defaultValue={formatNum(v.socketMm)}
                placeholder="mm"
                autoComplete="off"
              />
            </div>
          </div>
          <button className="tap mt-3" type="submit">
            Save oil spec
          </button>
          <p className="mt-2 text-xs text-muted">Saving marks this spec verified for your shop.</p>
        </form>
      ) : null}
    </section>
  );
}
