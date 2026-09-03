"use client";

import { useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/catalog";
import { isOilCategory } from "@/lib/catalog";
import { money } from "@/lib/format";
import { oilChargeCents, oilPerQtDollars } from "@/lib/oil-cost";

function dollars(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

export function AddItemCard({
  jobId,
  items,
  hideOil,
  quarts,
  viscosity,
  defaultJugQt,
  defaultJugCents,
}: {
  jobId: string;
  items: CatalogItem[];
  hideOil: boolean;
  quarts: number | null;
  viscosity?: string;
  defaultJugQt: number;
  defaultJugCents: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [oil, setOil] = useState<CatalogItem | null>(null);
  const [jug, setJug] = useState("");
  const [size, setSize] = useState(String(defaultJugQt || 5));
  const [qt, setQt] = useState(quarts && quarts > 0 ? String(quarts) : "");

  const catalog = hideOil ? items.filter((i) => !isOilCategory(i.category)) : items;
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? catalog.filter((i) => i.name.toLowerCase().includes(needle))
    : catalog;
  const exact = needle ? catalog.some((i) => i.name.toLowerCase() === needle) : false;
  const showOneOff = needle.length > 0 && matches.length === 0;

  function pickOil(item: CatalogItem) {
    const jugCents = item.jug_cents > 0 ? item.jug_cents : defaultJugCents;
    setOil(item);
    setJug(dollars(jugCents));
    setSize(String(item.jug_qt || defaultJugQt || 5));
    setQt(quarts && quarts > 0 ? String(quarts) : "");
    setOpen(false);
    setQ(item.name);
  }

  const jugCents = Math.round((Number(String(jug).replace(/[^0-9.-]/g, "")) || 0) * 100);
  const sizeN = Number(size) || 0;
  const qtN = Number(qt) || 0;
  const per = oilPerQtDollars(jugCents, sizeN);
  const total = oilChargeCents(jugCents, sizeN, qtN);
  const preview = useMemo(() => {
    if (!(per > 0) || !(qtN > 0) || !(total > 0)) return "";
    const perLabel = per.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return `about $${perLabel}/qt × ${qtN} qt = ${money(total)}`;
  }, [per, qtN, total]);

  return (
    <div className="mt-3 panel">
      <label className="lbl">Add item</label>
      <input
        className="field"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOil(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search catalog"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && !oil ? (
        <ul className="mt-2 max-h-64 overflow-auto rounded border-2 border-line">
          {matches.map((item) =>
            isOilCategory(item.category) ? (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center justify-between gap-2 px-3 text-left font-bold"
                  onClick={() => pickOil(item)}
                >
                  <span>{item.name}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">Oil</span>
                </button>
              </li>
            ) : (
              <li key={item.id}>
                <form action="/api/shop" method="post">
                  <input type="hidden" name="_op" value="add_part" />
                  <input type="hidden" name="job_id" value={jobId} />
                  <input type="hidden" name="description" value={item.name} />
                  <input type="hidden" name="qty" value="1" />
                  <input type="hidden" name="cost" value={dollars(item.cost_cents)} />
                  <input type="hidden" name="price" value={dollars(item.price_cents)} />
                  <button
                    className="flex min-h-14 w-full items-center justify-between gap-2 px-3 text-left font-bold"
                    type="submit"
                  >
                    <span>{item.name}</span>
                    <span className="num text-sm text-muted">
                      {item.cost_cents > 0 ? money(item.cost_cents) : item.category}
                    </span>
                  </button>
                </form>
              </li>
            ),
          )}
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No catalog match.</li>
          ) : null}
        </ul>
      ) : null}

      {oil ? (
        <form action="/api/shop" method="post" className="mt-3">
          <input type="hidden" name="_op" value="add_oil_part" />
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="catalog_id" value={oil.id} />
          <input type="hidden" name="description" value={oil.name} />
          {viscosity ? <input type="hidden" name="viscosity" value={viscosity} /> : null}
          <p className="text-sm text-muted">
            Charge the vehicle’s quarts. Leftover in the jug stays shop inventory.
          </p>
          <label className="lbl">Jug cost $</label>
          <input
            className="field"
            name="jug_cost"
            inputMode="decimal"
            value={jug}
            onChange={(e) => setJug(e.target.value)}
            placeholder="28.17"
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
          <p className="mt-2 text-xs text-muted">
            Charge is jug cost × quarts ÷ jug size, rounded once to the cent.
          </p>
          <button className="tap mt-3" type="submit" disabled={!total}>
            Add oil
          </button>
        </form>
      ) : null}

      {showOneOff ? (
        <form action="/api/shop" method="post" className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="_op" value="add_part" />
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="description" value={q.trim()} />
          <p className="text-sm text-muted">Add “{q.trim()}” as a new line. Not saved to the catalog unless you check below.</p>
          <label className="lbl">Qty</label>
          <input className="field" name="qty" inputMode="decimal" defaultValue="1" />
          <label className="lbl">Your cost $</label>
          <input className="field" name="cost" inputMode="decimal" />
          <label className="lbl">Customer price $</label>
          <input className="field" name="price" inputMode="decimal" placeholder="same as cost if blank" />
          <label className="mt-3 flex min-h-14 items-center gap-3 text-sm font-bold">
            <input type="checkbox" name="save_catalog" value="1" className="h-6 w-6" />
            Save to catalog
          </label>
          <label className="lbl">Category</label>
          <select className="field" name="category" defaultValue="Part">
            <option value="Part">Part</option>
            <option value="Oil">Oil</option>
            <option value="Shop">Shop</option>
          </select>
          <button className="tap mt-3" type="submit">
            Add line
          </button>
        </form>
      ) : null}

      {open && needle && matches.length > 0 && !exact && !oil ? (
        <p className="mt-2 text-xs text-muted">No exact name — keep typing or pick a match.</p>
      ) : null}
    </div>
  );
}
