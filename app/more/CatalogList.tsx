"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/catalog";
import { catalogInitials, catalogListPriceLabel } from "@/lib/catalog";

export function CatalogList({ items }: { items: CatalogItem[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () => (needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items),
    [items, needle],
  );

  return (
    <div>
      <input
        className="field rounded-full"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <ul className="mt-3">
        <li className="border-b border-line">
          <Link
            href="/more/catalog/new"
            className="flex min-h-[52px] items-center gap-3 px-1"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber/15 text-lg font-bold text-amber">
              +
            </span>
            <span className="font-bold">Add item</span>
          </Link>
        </li>
        {rows.map((item) => (
          <li key={item.id} className="border-b border-line">
            <Link
              href={`/more/catalog/${item.id}`}
              className="flex min-h-[52px] items-center gap-3 px-1"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-steel/15 text-[11px] font-extrabold uppercase tracking-wide text-amber">
                {catalogInitials(item.name)}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
              <span className="num shrink-0 text-sm text-muted">{catalogListPriceLabel(item)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-1 py-3 text-sm text-muted">No items match.</li>
        ) : null}
      </ul>
    </div>
  );
}
