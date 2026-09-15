"use client";

import { PHOTO_KINDS, PHOTO_KIND_LABEL, type PhotoKind } from "@/lib/photo-kind";

export function PhotoKindPicker({
  value,
  onChange,
  name,
}: {
  value: PhotoKind | "";
  onChange: (k: PhotoKind) => void;
  name?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {PHOTO_KINDS.map((k) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            className={on ? "tap" : "tap tap-steel"}
            aria-pressed={on}
            onClick={() => onChange(k)}
          >
            {PHOTO_KIND_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}
