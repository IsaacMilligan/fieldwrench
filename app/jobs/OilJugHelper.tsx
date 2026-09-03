"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { oilChargeCents, oilPerQtCents } from "@/lib/oil-cost";

export function OilJugHelper({
  jobId,
  jugCostDollars,
  jugQt,
  quarts,
  viscosity,
}: {
  jobId: string;
  jugCostDollars: string;
  jugQt: number;
  quarts: number | null;
  viscosity?: string;
}) {
  const [jug, setJug] = useState(jugCostDollars);
  const [size, setSize] = useState(String(jugQt || 5));
  const [qt, setQt] = useState(quarts && quarts > 0 ? String(quarts) : "");
  const jugCents = Math.round((Number(jug.replace(/[^0-9.-]/g, "")) || 0) * 100);
  const sizeN = Number(size) || 0;
  const qtN = Number(qt) || 0;
  const per = oilPerQtCents(jugCents, sizeN);
  const total = oilChargeCents(jugCents, sizeN, qtN);
  const preview = useMemo(() => {
    if (!(per > 0) || !(qtN > 0)) return "";
    return `${money(per)} / qt × ${qtN} qt = ${money(total)}`;
  }, [per, qtN, total]);

  return (
    <form action="/api/shop" method="post" className="mt-3 panel">
      <input type="hidden" name="_op" value="add_oil_part" />
      <input type="hidden" name="job_id" value={jobId} />
      {viscosity ? <input type="hidden" name="viscosity" value={viscosity} /> : null}
      <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
        Oil from jugs
      </h3>
      <p className="mt-2 text-sm text-muted">
        Charge the vehicle’s quarts, not leftover in the jug. That oil stays shop inventory.
      </p>
      <label className="lbl">Jug cost $</label>
      <input
        className="field"
        name="jug_cost"
        inputMode="decimal"
        value={jug}
        onChange={(e) => setJug(e.target.value)}
        placeholder="30.03"
      />
      <label className="lbl">Jug size (qt)</label>
      <input
        className="field"
        name="jug_qt"
        inputMode="decimal"
        value={size}
        onChange={(e) => setSize(e.target.value)}
      />
      <label className="lbl">Quarts to charge</label>
      <input
        className="field"
        name="quarts"
        inputMode="decimal"
        value={qt}
        onChange={(e) => setQt(e.target.value)}
        placeholder="qt"
        required
      />
      {preview ? <p className="mt-3 num text-2xl text-amber">{preview}</p> : null}
      <p className="mt-2 text-xs text-muted">$/qt is rounded to the cent, then × quarts.</p>
      <button className="tap mt-3" type="submit" disabled={!total}>
        Add oil to parts
      </button>
    </form>
  );
}
