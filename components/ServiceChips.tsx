"use client";

import { useState } from "react";
import { BEV_HIDDEN_SERVICES, SERVICES, type ServiceId } from "@/lib/services";
import { formatDurationLabel } from "@/lib/bookable-services";

export type ServiceChipItem = { id: string; label: string; blurb?: string; durationMin?: number };

export function ServiceChips({
  items,
  bev = false,
  variant = "chips",
  onChange,
}: {
  items?: ServiceChipItem[];
  bev?: boolean;
  variant?: "chips" | "rows";
  onChange?: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [openBlurb, setOpenBlurb] = useState<string | null>(null);
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

  if (variant === "rows") {
    return (
      <ul className="divide-y divide-line overflow-hidden rounded-xl border-2 border-line">
        {list.map((s) => {
          const on = picked.includes(s.id);
          const dur = s.durationMin != null ? formatDurationLabel(s.durationMin) : "";
          return (
            <li key={s.id} className={on ? "bg-amber text-[#120e04]" : "bg-panel2"}>
              <div className="flex items-stretch">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-1">
                  <input
                    className="h-5 w-5 shrink-0 accent-[#e8a317]"
                    type="checkbox"
                    name="service"
                    value={s.id}
                    checked={on}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="min-w-0 truncate text-sm font-extrabold leading-tight">
                    {s.label}
                    {dur ? ` · ${dur}` : ""}
                  </span>
                </label>
                {s.blurb ? (
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                    aria-expanded={openBlurb === s.id}
                    aria-label={`About ${s.label}`}
                    onClick={() => setOpenBlurb((cur) => (cur === s.id ? null : s.id))}
                  >
                    <span className={`text-sm ${openBlurb === s.id ? "rotate-90" : ""}`} aria-hidden>
                      ▶
                    </span>
                  </button>
                ) : null}
              </div>
              {openBlurb === s.id && s.blurb ? (
                <p className={`px-3 pb-2 text-xs font-semibold ${on ? "text-[#120e04]/70" : "text-muted"}`}>{s.blurb}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
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
          </label>
        );
      })}
    </div>
  );
}
