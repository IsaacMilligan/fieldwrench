"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type CalItem = {
  kind: "job" | "booking";
  id: string;
  day: string;
  customer: string;
  vehicle: string;
  services: string;
  href: string;
};

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function CalendarMonth({
  year,
  month,
  today,
  items,
}: {
  year: number;
  month: number;
  today: string;
  items: CalItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    today.startsWith(`${year}-${String(month).padStart(2, "0")}`)
      ? today
      : `${year}-${String(month).padStart(2, "0")}-01`,
  );
  useEffect(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    setSelected((s) => (s.startsWith(prefix) ? s : `${prefix}-01`));
  }, [year, month]);
  const start = useRef<{ x: number; y: number } | null>(null);

  const marked = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.day, (m.get(it.day) ?? 0) + 1);
    return m;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ day: d, iso });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [year, month]);

  const dayItems = items.filter((it) => it.day === selected);
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  function go(delta: number) {
    const n = shiftMonth(year, month, delta);
    router.push(`/calendar?y=${n.year}&m=${n.month}`);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button className="tap tap-steel min-h-14 w-14 shrink-0 px-0" type="button" onClick={() => go(-1)} aria-label="Previous month">
          ‹
        </button>
        <div className="flex-1 text-center font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
          {title}
        </div>
        <button className="tap tap-steel min-h-14 w-14 shrink-0 px-0" type="button" onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div
        className="mt-4 rounded-2xl border border-line bg-panel p-3"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          start.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
          go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold uppercase tracking-widest text-muted">
          {WEEK.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={`e-${i}`} className="min-h-12" />;
            const isToday = c.iso === today;
            const isSel = c.iso === selected;
            const count = marked.get(c.iso) ?? 0;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setSelected(c.iso)}
                className={`flex min-h-12 flex-col items-center justify-center rounded-full text-base font-bold ${
                  isSel ? "bg-amber text-[#120e04]" : isToday ? "text-amber" : "text-ink"
                } ${isToday && !isSel ? "ring-2 ring-amber" : ""}`}
              >
                {c.day}
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${count ? (isSel ? "bg-[#120e04]" : "bg-amber") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          {selected}
        </h2>
        {dayItems.length === 0 ? (
          <>
            <p className="mt-3 text-lg text-muted">Nothing on this day</p>
            <Link href="/jobs?new=1" className="tap mt-4 flex items-center justify-center">
              Create new job
            </Link>
          </>
        ) : (
          <ul className="mt-3 space-y-2">
            {dayItems.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <Link href={it.href} className="block rounded-xl border border-line bg-panel2 px-3 py-3">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-muted">
                    {it.kind === "job" ? "Job" : "Booking"}
                  </div>
                  <div className="text-lg font-bold">{it.customer}</div>
                  <div className="text-sm text-muted">{it.vehicle}</div>
                  {it.services ? <div className="mt-1 text-sm text-amber">{it.services}</div> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
