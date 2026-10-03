"use client";

import { useEffect, useState } from "react";
import { drainTqText, formatNum, formatQt, oilSpecComplete, type OilSpecValues } from "@/lib/oil-specs";
import { OReillyProButton } from "@/components/OReillyProButton";
import { OIL_SAVED_EVENT, OilScreenshotImport } from "@/components/OilScreenshotImport";

type View = { key: string; status: "verified"; oil: OilSpecValues } | { key: string; status: "none" };

/**
 * Create-job / add-vehicle oil line. Shows the shop's VERIFIED oil spec for this exact
 * year/make/model/engine, or nothing on file + O'Reilly Pro. Never guesses.
 */
export function ShopOilHint({
  year,
  make,
  model,
  engine,
}: {
  year: string | number | null | undefined;
  make: string;
  model: string;
  engine?: string | null;
}) {
  const eng = engine && engine !== "__unsure__" ? engine : "";
  const key = `${year ?? ""}|${make}|${model}|${eng}`;
  const ready = Boolean(year && make && model);
  const [view, setView] = useState<View | null>(null);
  const [nonce, setNonce] = useState(0);

  // Refetch after a screenshot import saves a spec.
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    window.addEventListener(OIL_SAVED_EVENT, bump);
    return () => window.removeEventListener(OIL_SAVED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const params = new URLSearchParams({ year: String(year), make, model });
    if (eng) params.set("engine", eng);
    fetch(`/api/oil?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { status?: string; oil?: OilSpecValues };
        if (!live) return;
        if (res.ok && json.status === "verified" && json.oil) setView({ key, status: "verified", oil: json.oil });
        else setView({ key, status: "none" });
      })
      .catch(() => {
        if (live) setView({ key, status: "none" });
      });
    return () => {
      live = false;
    };
  }, [ready, key, year, make, model, eng, nonce]);

  if (!ready) return null;
  const current = view && view.key === key ? view : null;

  return (
    <div className="mt-3">
      {!current ? <p className="text-sm text-muted">Checking shop oil specs…</p> : null}
      {current?.status === "verified" ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="lbl mb-0 mt-0">Engine oil</p>
            <span className="text-xs font-bold uppercase tracking-widest text-green">Verified</span>
          </div>
          <div className="num mt-1 text-2xl text-amber">
            {[
              current.oil.viscosity || null,
              current.oil.qtWithFilter ? `${formatQt(current.oil.qtWithFilter)} w/ filter` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {drainTqText(current.oil) || current.oil.socketMm ? (
            <p className="mt-1 text-sm text-muted">
              Drain plug
              {drainTqText(current.oil) ? ` ${drainTqText(current.oil)}` : ""}
              {current.oil.socketMm ? ` · ${formatNum(current.oil.socketMm)} mm socket` : ""}
            </p>
          ) : null}
          {!oilSpecComplete(current.oil) ? <OReillyProButton className="mt-2" /> : null}
        </>
      ) : null}
      {current?.status === "none" ? (
        <>
          <p className="lbl mb-0 mt-0">Engine oil</p>
          <p className="mt-1 text-sm text-muted">
            No oil spec on file for this {eng ? "engine" : "vehicle"}. Save it on the job or vehicle screen.
          </p>
          <OReillyProButton className="mt-2" />
        </>
      ) : null}
      {current ? (
        <OilScreenshotImport key={key} className="mt-2" year={year} make={make} model={model} engine={eng} />
      ) : null}
    </div>
  );
}
