import { formatQt, type OilCatalog } from "@/lib/oil-specs";
import { isElectricEngine } from "@/lib/vpic";

export function OilSpecCard({
  vehicleId,
  catalog,
  savedQt,
  savedViscosity,
  savedQtWithout,
  savedViscosityAlt,
  compact = false,
  next,
  engine,
}: {
  vehicleId?: string;
  catalog: OilCatalog | null;
  savedQt?: number | null;
  savedViscosity?: string | null;
  savedQtWithout?: number | null;
  savedViscosityAlt?: string | null;
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
        <p className="mt-2 text-sm text-muted">This vehicle does not take engine oil.</p>
      </section>
    );
  }
  const saved = Boolean((savedQt && savedQt > 0) || (savedViscosity && savedViscosity.trim()));
  const primaryQt = saved ? savedQt ?? null : catalog?.qtWithFilter ?? null;
  const primaryVis = saved ? String(savedViscosity ?? "").trim() : catalog?.viscosity ?? "";
  const without = saved ? savedQtWithout ?? null : catalog?.qtWithoutFilter ?? null;
  const alt = saved ? String(savedViscosityAlt ?? "").trim() : catalog?.viscosityAlt ?? "";
  const hasPrimary = Boolean((primaryQt && primaryQt > 0) || primaryVis);
  const source = saved ? "Saved" : catalog ? "Catalog" : "";
  const catalogType = String(catalog?.oilType ?? "");
  const showSynthetic = hasPrimary && !/conventional/i.test(catalogType);

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
          {showSynthetic ? <p className="mt-2 text-sm font-bold text-steel">Full synthetic</p> : null}
          {(without && without > 0) || alt ? (
            <p className="mt-2 text-sm text-muted">
              {without && without > 0 ? `${formatQt(without)} without filter` : null}
              {without && without > 0 && alt ? " · " : null}
              {alt ? `also approved: ${alt}` : null}
            </p>
          ) : null}
          {saved && catalog && (catalog.qtWithFilter || catalog.viscosity) ? (
            <p className="mt-2 text-xs text-muted">
              Catalog: {catalog.qtWithFilter ? `${formatQt(catalog.qtWithFilter)} with filter` : "—"}
              {catalog.viscosity ? ` · ${catalog.viscosity}` : ""}
            </p>
          ) : null}
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
            defaultValue={savedQt && savedQt > 0 ? String(savedQt) : ""}
            placeholder="5.0"
          />
          <label className="lbl">Viscosity</label>
          <input
            className="field"
            name="oil_viscosity"
            defaultValue={savedViscosity ?? ""}
            placeholder="0W-20"
          />
          <button className="tap mt-3" type="submit">
            Save oil spec
          </button>
        </form>
      ) : null}
    </section>
  );
}
