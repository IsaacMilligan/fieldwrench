"use client";

import { useState } from "react";
import type { CatalogItem, CatalogTag } from "@/lib/catalog";
import { CatalogTagPicker } from "./CatalogTagPicker";

export function CatalogEditForm({ item }: { item?: CatalogItem }) {
  const [tag, setTag] = useState<CatalogTag>(item?.tag ?? "part");
  const [laborMode, setLaborMode] = useState<"hours" | "fixed">(item?.labor_mode ?? "fixed");
  const isNew = !item;

  return (
    <>
      <form action="/api/shop" method="post">
        <input type="hidden" name="_op" value={isNew ? "add_catalog_item" : "update_catalog_item"} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="lbl">Name</label>
        <input className="field" name="name" defaultValue={item?.name ?? ""} required />
        <CatalogTagPicker value={tag} onChange={setTag} />
        {tag === "oil" ? (
          <>
            <label className="lbl">Jug size (qt)</label>
            <input
              className="field"
              name="jug_qt"
              inputMode="decimal"
              defaultValue={String(item?.jug_qt || 5)}
            />
            <label className="lbl">Cost $</label>
            <input
              className="field"
              name="jug_cost"
              inputMode="decimal"
              defaultValue={
                item && (item.jug_cents > 0 || item.cost_cents > 0)
                  ? ((item.jug_cents > 0 ? item.jug_cents : item.cost_cents) / 100).toFixed(2)
                  : ""
              }
              placeholder="28.17"
            />
            <p className="mt-2 text-xs text-muted">
              Job charge = jug cost × vehicle quarts ÷ jug size, rounded once. Leftover stays shop oil.
            </p>
          </>
        ) : tag === "labor" ? (
          <>
            <p className="lbl">Pricing</p>
            <input type="hidden" name="labor_mode" value={laborMode} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`tap ${laborMode === "hours" ? "" : "tap-steel"}`}
                onClick={() => setLaborMode("hours")}
              >
                Hours × rate
              </button>
              <button
                type="button"
                className={`tap ${laborMode === "fixed" ? "" : "tap-steel"}`}
                onClick={() => setLaborMode("fixed")}
              >
                Fixed $
              </button>
            </div>
            {laborMode === "hours" ? (
              <>
                <label className="lbl">Hours</label>
                <input
                  className="field"
                  name="labor_hours"
                  inputMode="decimal"
                  defaultValue={String(item?.labor_hours || 1)}
                />
                <p className="mt-2 text-xs text-muted">
                  Amount = hours × Settings labor rate $/hr. On the job you can change hours.
                </p>
              </>
            ) : (
              <>
                <label className="lbl">Amount $</label>
                <input
                  className="field"
                  name="cost"
                  inputMode="decimal"
                  defaultValue={
                    item && (item.price_cents > 0 || item.cost_cents > 0)
                      ? ((item.price_cents > item.cost_cents ? item.price_cents : item.cost_cents) / 100).toFixed(2)
                      : ""
                  }
                  placeholder="175"
                />
                <p className="mt-2 text-xs text-muted">Flat labor. You can still edit the $ on the job. Not parts-taxed.</p>
              </>
            )}
          </>
        ) : (
          <>
            <label className="lbl">Cost $</label>
            <input
              className="field"
              name="cost"
              inputMode="decimal"
              defaultValue={item && item.cost_cents > 0 ? (item.cost_cents / 100).toFixed(2) : ""}
            />
            <label className="lbl">Customer price $</label>
            <input
              className="field"
              name="price"
              inputMode="decimal"
              defaultValue={
                item && item.price_cents > 0 && item.price_cents > item.cost_cents
                  ? (item.price_cents / 100).toFixed(2)
                  : ""
              }
              placeholder="same as cost if blank"
            />
            <p className="mt-2 text-xs text-muted">Qty is how many of this part on the job. No jug math.</p>
          </>
        )}
        <button className="tap mt-4" type="submit">
          {isNew ? "Add item" : "Save item"}
        </button>
      </form>
      {item ? (
        <form action="/api/shop" method="post" className="mt-4">
          <input type="hidden" name="_op" value="delete_catalog_item" />
          <input type="hidden" name="id" value={item.id} />
          <button className="tap tap-red" type="submit">
            Delete item
          </button>
        </form>
      ) : null}
    </>
  );
}
