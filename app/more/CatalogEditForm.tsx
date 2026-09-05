"use client";

import { useState } from "react";
import type { CatalogItem } from "@/lib/catalog";
import { isOilCategory } from "@/lib/catalog";

export function CatalogEditForm({ item }: { item?: CatalogItem }) {
  const [category, setCategory] = useState(item?.category ?? "Part");
  const isNew = !item;

  return (
    <>
      <form action="/api/shop" method="post">
        <input type="hidden" name="_op" value={isNew ? "add_catalog_item" : "update_catalog_item"} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="lbl">Name</label>
        <input className="field" name="name" defaultValue={item?.name ?? ""} required />
        <label className="lbl">Category</label>
        <select
          className="field"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CatalogItem["category"])}
        >
          <option value="Part">Part</option>
          <option value="Oil">Oil</option>
          <option value="Shop">Shop</option>
        </select>
        <label className="lbl">Your cost $</label>
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
        {isOilCategory(category) ? (
          <>
            <label className="lbl">Jug size (qt)</label>
            <input
              className="field"
              name="jug_qt"
              inputMode="decimal"
              defaultValue={String(item?.jug_qt || 5)}
            />
            <label className="lbl">Jug cost $</label>
            <input
              className="field"
              name="jug_cost"
              inputMode="decimal"
              defaultValue={item && item.jug_cents > 0 ? (item.jug_cents / 100).toFixed(2) : ""}
              placeholder="28.17"
            />
            <p className="mt-2 text-xs text-muted">
              Jobs charge vehicle quarts × jug ÷ size, rounded once. Leftover stays shop oil.
            </p>
          </>
        ) : null}
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
