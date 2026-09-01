"use client";

import { useState } from "react";
import { BEV_HIDDEN_SERVICES, SERVICES, type ServiceId } from "@/lib/services";

export function ServiceChips({
  bev = false,
  onChange,
}: {
  bev?: boolean;
  onChange?: () => void;
}) {
  const [picked, setPicked] = useState<ServiceId[]>([]);
  const list = bev ? SERVICES.filter((s) => !BEV_HIDDEN_SERVICES.has(s.id)) : SERVICES;

  function toggle(id: ServiceId) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    onChange?.();
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {list.map((s) => {
        const on = picked.includes(s.id);
        return (
          <label
            key={s.id}
            className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-sm font-extrabold leading-tight ${
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
