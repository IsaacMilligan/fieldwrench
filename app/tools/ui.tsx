"use client";

import { useState } from "react";
import { ScanVinButton, VIN_PAIR_BTN } from "@/components/ScanVinButton";

type Decode = {
  error?: string;
  vin?: string;
  year?: number | null;
  make?: string;
  model?: string;
  engine?: string;
  oil?: {
    qtWithFilter: number | null;
    viscosity: string;
    qtWithoutFilter: number | null;
    viscosityAlt: string;
    oilType: string;
  } | null;
  bev?: boolean;
};

export function VinTool({
  defaultVin,
  vehicles,
}: {
  defaultVin?: string;
  vehicles: { id: string; label: string }[];
}) {
  const [vin, setVin] = useState(defaultVin ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Decode | null>(null);

  async function decode() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/vin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const json = (await res.json()) as Decode;
      setResult(json);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        VIN decode
      </h2>
      <p className="mt-1 text-sm text-muted">Live NHTSA vPIC. 17 characters. No I, O, or Q.</p>
      <label className="lbl">VIN</label>
      <input
        className="field font-mono uppercase"
        value={vin}
        maxLength={17}
        onChange={(e) => setVin(e.target.value.toUpperCase())}
        placeholder="1FTFW1E59JFA12345"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ScanVinButton
          onVin={(v) => {
            setVin(v);
          }}
        />
        <button className={VIN_PAIR_BTN} type="button" onClick={decode} disabled={busy}>
          {busy ? "Decoding…" : "Decode"}
        </button>
      </div>
      {result?.error ? <p className="mt-3 text-red">{result.error}</p> : null}
      {result && !result.error ? (
        <div className="mt-4">
          <div className="num text-3xl">
            {result.year} {result.make} {result.model}
            {result.engine ? ` ${result.engine}` : ""}
          </div>
          {result.bev || result.engine === "Electric" ? (
            <div className="mt-4 panel">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
                Engine oil
              </h2>
              <div className="num mt-3 text-4xl text-amber">N/A</div>
              <p className="mt-2 text-sm text-muted">This vehicle does not take engine oil.</p>
            </div>
          ) : result.oil && (result.oil.qtWithFilter || result.oil.viscosity) ? (
            <div className="mt-4 panel">
              <div className="flex items-baseline justify-between gap-3">
                <div className="num text-4xl text-amber">
                  {result.oil.qtWithFilter ? `${result.oil.qtWithFilter} qt with filter` : "—"}
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">Catalog</span>
              </div>
              <div className="num mt-2 text-4xl">{result.oil.viscosity || "—"}</div>
              {result.oil.oilType && !/conventional/i.test(result.oil.oilType) ? (
                <p className="mt-2 text-sm font-bold text-steel">Full synthetic</p>
              ) : result.oil.qtWithFilter || result.oil.viscosity ? (
                <p className="mt-2 text-sm font-bold text-steel">Full synthetic</p>
              ) : null}
              {(result.oil.qtWithoutFilter || result.oil.viscosityAlt) ? (
                <p className="mt-2 text-sm text-muted">
                  {result.oil.qtWithoutFilter ? `${result.oil.qtWithoutFilter} qt without filter` : null}
                  {result.oil.qtWithoutFilter && result.oil.viscosityAlt ? " · " : null}
                  {result.oil.viscosityAlt ? `also approved: ${result.oil.viscosityAlt}` : null}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-lg font-bold text-amber">No spec on file</p>
          )}
          <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="apply_vin" />
            <input type="hidden" name="vin" value={result.vin} />
            <input type="hidden" name="year" value={result.year ?? ""} />
            <input type="hidden" name="make" value={result.make ?? ""} />
            <input type="hidden" name="model" value={result.model ?? ""} />
            <input type="hidden" name="engine" value={result.engine ?? ""} />
            <label className="lbl">Save onto vehicle</label>
            <select className="field" name="vehicle_id" required>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {!(result.bev || result.engine === "Electric") &&
            !(result.oil && (result.oil.qtWithFilter || result.oil.viscosity)) ? (
              <>
                <label className="lbl">Capacity (qt, with filter)</label>
                <input className="field" name="oil_qt" inputMode="decimal" placeholder="qt" />
                <label className="lbl">Viscosity</label>
                <input className="field" name="oil_viscosity" placeholder="SAE" />
              </>
            ) : null}
            <button className="tap tap-green mt-3" type="submit">
              Save year/make/model
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

