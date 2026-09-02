"use client";

import { useState, type FormEvent } from "react";
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

const NEW_CUSTOMER = "__new__";

export function VinTool({
  defaultVin,
  vehicles,
}: {
  defaultVin?: string;
  vehicles: { id: string; vin?: string; label: string }[];
}) {
  const [vin, setVin] = useState(defaultVin ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Decode | null>(null);
  const [target, setTarget] = useState(NEW_CUSTOMER);

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

  function onSave(e: FormEvent<HTMLFormElement>) {
    if (target === NEW_CUSTOMER) return;
    const picked = vehicles.find((v) => v.id === target);
    const next = (result?.vin || "").toUpperCase();
    const prev = (picked?.vin || "").toUpperCase();
    if (prev && next && prev !== next) {
      if (!confirm(`This vehicle already has VIN ${prev}. Replace it with ${next}?`)) {
        e.preventDefault();
      }
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
              <p className="mt-2 text-sm text-muted">No engine oil and no drain plug.</p>
            </div>
          ) : null}
          <form action="/api/shop" method="post" className="mt-4" onSubmit={onSave}>
            <input type="hidden" name="_op" value="apply_vin" />
            <input type="hidden" name="vin" value={result.vin} />
            <input type="hidden" name="year" value={result.year ?? ""} />
            <input type="hidden" name="make" value={result.make ?? ""} />
            <input type="hidden" name="model" value={result.model ?? ""} />
            <input type="hidden" name="engine" value={result.engine ?? ""} />
            <label className="lbl">Save onto vehicle</label>
            <select
              className="field"
              name="vehicle_id"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value={NEW_CUSTOMER}>New customer</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {target === NEW_CUSTOMER ? (
              <>
                <label className="lbl" htmlFor="cust_name">
                  Name
                </label>
                <input className="field" id="cust_name" name="name" required autoComplete="name" />
                <label className="lbl" htmlFor="cust_phone">
                  Phone
                </label>
                <input className="field" id="cust_phone" name="phone" required autoComplete="tel" />
                <label className="lbl" htmlFor="plate">
                  Plate (optional)
                </label>
                <input className="field" id="plate" name="plate" autoComplete="off" />
                <label className="lbl" htmlFor="mileage">
                  Mileage (optional)
                </label>
                <input className="field" id="mileage" name="mileage" inputMode="numeric" />
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
