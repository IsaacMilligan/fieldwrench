"use client";

import { CATALOG_TAGS, type CatalogTag } from "@/lib/catalog";

export function CatalogTagPicker({
  value,
  onChange,
  name = "tag",
  tags = CATALOG_TAGS,
}: {
  value: CatalogTag;
  onChange: (tag: CatalogTag) => void;
  name?: string;
  tags?: readonly CatalogTag[];
}) {
  const cols = tags.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      {tags.length > 1 ? (
        <>
          <p className="lbl">Tag</p>
          <div className={`grid ${cols} gap-2`}>
            {tags.map((t) => (
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
        </>
      ) : null}
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
