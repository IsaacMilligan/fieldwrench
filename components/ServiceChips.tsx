"use client";

import { useState } from "react";
import { BEV_HIDDEN_SERVICES, SERVICES, type ServiceId } from "@/lib/services";

export type ServiceChipItem = { id: string; label: string; blurb?: string };

export function ServiceChips({
  items,
  bev = false,
  onChange,
}: {
  items?: ServiceChipItem[];
  bev?: boolean;
  onChange?: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const source: ServiceChipItem[] = items ?? SERVICES.map((s) => ({ id: s.id, label: s.label }));
  const list = bev
    ? source.filter((s) => !BEV_HIDDEN_SERVICES.has(s.id as ServiceId))
    : source;

  function toggle(id: string) {
    setPicked((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      onChange?.(next);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {list.map((s) => {
        const on = picked.includes(s.id);
        return (
          <label
            key={s.id}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-sm font-extrabold leading-tight ${
              on ? "border-amber bg-amber text-[#120e04]" : "border-line bg-panel2"
            }`}
          >
            <input
              className="sr-only"
              type="checkbox"
              name="service"
              value={s.id}
              checked={on}
              onChange={() => toggle(s.id)}
            />
            {s.label}
            {s.blurb ? <span className={`mt-1 text-[11px] font-semibold ${on ? "text-[#120e04]/70" : "text-muted"}`}>{s.blurb}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
