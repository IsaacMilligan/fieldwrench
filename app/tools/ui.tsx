"use client";

import { useMemo, useState } from "react";
import { applyVinAction } from "@/lib/actions";

type Decode = {
  error?: string;
  vin?: string;
  year?: number | null;
  make?: string;
  model?: string;
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
      <button className="tap mt-4" type="button" onClick={decode} disabled={busy}>
        {busy ? "Talking to NHTSA…" : "Decode VIN"}
      </button>
      {result?.error ? <p className="mt-3 text-red">{result.error}</p> : null}
      {result && !result.error ? (
        <div className="mt-4">
          <div className="num text-3xl">
            {result.year} {result.make} {result.model}
          </div>
          <form action={applyVinAction} className="mt-4">
            <input type="hidden" name="vin" value={result.vin} />
            <input type="hidden" name="year" value={result.year ?? ""} />
            <input type="hidden" name="make" value={result.make ?? ""} />
            <input type="hidden" name="model" value={result.model ?? ""} />
            <label className="lbl">Save onto vehicle</label>
            <select className="field" name="vehicle_id" required>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <button className="tap tap-green mt-3" type="submit">
              Save year/make/model
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export function DtcTool({ initial }: { initial: { code: string; desc: string }[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return initial.slice(0, 12);
    return initial
      .filter((c) => c.code.includes(s) || c.desc.toUpperCase().includes(s))
      .slice(0, 30);
  }, [q, initial]);

  return (
    <section className="mt-6 panel">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        DTC lookup
      </h2>
      <p className="mt-1 text-sm text-muted">
        Bundled generic OBD-II list. Works offline. No paid API.
      </p>
      <label className="lbl">Code</label>
      <input
        className="field font-mono uppercase"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="P0302"
      />
      <ul className="mt-4 space-y-2">
        {hits.length === 0 ? (
          <li className="text-red">No match in the bundled list.</li>
        ) : (
          hits.map((h) => (
            <li key={h.code} className="border-b border-line pb-2">
              <div className="font-mono text-xl font-bold text-amber">{h.code}</div>
              <div className="text-sm">{h.desc}</div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
