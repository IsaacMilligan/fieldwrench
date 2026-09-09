"use client";

import { CATALOG_TAGS, type CatalogTag } from "@/lib/catalog";

export function CatalogTagPicker({
  value,
  onChange,
  name = "tag",
}: {
  value: CatalogTag;
  onChange: (tag: CatalogTag) => void;
  name?: string;
}) {
  return (
    <div>
      <p className="lbl">Tag</p>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-3 gap-2">
        {CATALOG_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tap ${value === t ? "" : "tap-steel"}`}
            onClick={() => onChange(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CatalogTagBadge({ tag }: { tag: CatalogTag }) {
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-muted">
      {tag}
    </span>
  );
}
