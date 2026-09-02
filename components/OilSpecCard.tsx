import { formatQt } from "@/lib/oil-specs";
import { isElectricEngine } from "@/lib/vpic";

export function OilSpecCard({
  vehicleId,
  savedQt,
  savedViscosity,
  savedTq,
  savedSocket,
  shopQt,
  shopViscosity,
  shopTq,
  shopSocket,
  compact = false,
  next,
  engine,
}: {
  vehicleId?: string;
  savedQt?: number | null;
  savedViscosity?: string | null;
  savedTq?: number | null;
  savedSocket?: string | null;
  shopQt?: number | null;
  shopViscosity?: string | null;
  shopTq?: number | null;
  shopSocket?: string | null;
  compact?: boolean;
  next?: string;
  engine?: string | null;
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

  const vehicleSaved = Boolean(
    (savedQt && savedQt > 0) ||
      (savedViscosity && savedViscosity.trim()) ||
      (savedTq && savedTq > 0) ||
      (savedSocket && savedSocket.trim()),
  );
  const shopSaved = Boolean(
    (shopQt && shopQt > 0) ||
      (shopViscosity && shopViscosity.trim()) ||
      (shopTq && shopTq > 0) ||
      (shopSocket && shopSocket.trim()),
  );

  const source = vehicleSaved ? "Saved" : shopSaved ? "Saved for this engine" : "";
  const primaryQt = vehicleSaved ? savedQt ?? null : shopSaved ? shopQt ?? null : null;
  const primaryVis = vehicleSaved
    ? String(savedViscosity ?? "").trim()
    : shopSaved
      ? String(shopViscosity ?? "").trim()
      : "";
  const primaryTq = vehicleSaved ? savedTq ?? null : shopSaved ? shopTq ?? null : null;
  const primarySocket = vehicleSaved
    ? String(savedSocket ?? "").trim()
    : shopSaved
      ? String(shopSocket ?? "").trim()
      : "";
  const hasPrimary = Boolean(
    (primaryQt && primaryQt > 0) || primaryVis || (primaryTq && primaryTq > 0) || primarySocket,
  );

  return (
    <section className={compact ? "mt-3 panel" : "mt-6 panel"}>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Engine oil
      </h2>
      {hasPrimary ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="num text-4xl text-amber">
              {primaryQt && primaryQt > 0 ? `${formatQt(primaryQt)} with filter` : "—"}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted">{source}</span>
          </div>
          <div className="num mt-2 text-4xl">{primaryVis || "—"}</div>
          {(primaryTq && primaryTq > 0) || primarySocket ? (
            <p className="mt-2 text-sm text-muted">
              Drain plug
              {primaryTq && primaryTq > 0 ? ` ${primaryTq} ft-lb` : ""}
              {primarySocket ? ` · ${primarySocket} mm` : ""}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-bold text-steel">Full synthetic</p>
        </div>
      ) : (
        <p className="mt-3 text-lg font-bold text-amber">No spec on file</p>
      )}
      {vehicleId ? (
        <form action="/api/shop" method="post" className="mt-4">
          <input type="hidden" name="_op" value="save_oil_spec" />
          <input type="hidden" name="id" value={vehicleId} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label className="lbl">Capacity (qt, with filter)</label>
          <input
            className="field"
            name="oil_qt"
            inputMode="decimal"
            defaultValue={hasPrimary && primaryQt && primaryQt > 0 ? String(primaryQt) : ""}
            placeholder="qt"
          />
          <label className="lbl">Viscosity</label>
          <input
            className="field"
            name="oil_viscosity"
            defaultValue={hasPrimary ? primaryVis : ""}
            placeholder="SAE"
          />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="lbl">Drain plug TQ (ft-lb)</label>
              <input
                className="field"
                name="oil_drain_tq"
                inputMode="decimal"
                defaultValue={hasPrimary && primaryTq && primaryTq > 0 ? String(primaryTq) : ""}
                placeholder="ft-lb"
              />
            </div>
            <div>
              <label className="lbl">Socket (mm)</label>
              <input
                className="field"
                name="oil_socket"
                inputMode="numeric"
                defaultValue={hasPrimary ? primarySocket : ""}
                placeholder="mm"
              />
            </div>
          </div>
          <button className="tap mt-3" type="submit">
            Save oil spec
          </button>
        </form>
      ) : null}
    </section>
  );
}
