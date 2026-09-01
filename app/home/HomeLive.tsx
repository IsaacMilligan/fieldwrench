"use client";

import { useEffect, useState } from "react";
import { TZ } from "@/lib/format";
import { weatherGlyph, type HourPill } from "@/lib/weather";

function denverNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour24 = Number(get("hour"));
  const greeting =
    hour24 < 12 ? "Good morning" : hour24 < 17 ? "Good afternoon" : "Good evening";
  const hour12 = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return {
    greeting,
    weekday: get("weekday"),
    date: `${get("month")} ${get("day")}`,
    time: hour12,
  };
}

function useDenverClock() {
  const [now, setNow] = useState(denverNow);
  useEffect(() => {
    const tick = () => setNow(denverNow());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function GreetingLine() {
  const now = useDenverClock();
  return <p className="mt-1 text-sm text-muted">{now.greeting}</p>;
}

export function TodayStamp() {
  const now = useDenverClock();
  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        {now.weekday}
      </div>
      <div className="mt-1 text-lg text-steel">
        {now.date}
        <span className="ml-2 text-muted">{now.time}</span>
      </div>
    </div>
  );
}

export function StartsIn({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function tick() {
      const ms = new Date(iso).getTime() - Date.now();
      if (!Number.isFinite(ms)) {
        setLabel("");
        return;
      }
      if (ms <= 0) {
        setLabel("Started");
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`Starts in ${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!label) return null;
  return <p className="text-sm font-extrabold uppercase tracking-widest text-amber">{label}</p>;
}

const HIDE_KEY = "fw-hide-money";

export function MoneyAmounts({
  unpaidLabel,
  unpaidCount,
  revenueLabel,
  profitLabel,
  profitNegative,
}: {
  unpaidLabel: string;
  unpaidCount: number;
  revenueLabel: string;
  profitLabel: string;
  profitNegative: boolean;
}) {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    try {
      setHide(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  function toggle() {
    const next = !hide;
    setHide(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Unpaid AR</div>
          <div className="num mt-1 text-3xl text-red">{hide ? "••••" : unpaidLabel}</div>
          <div className="mt-1 text-sm text-muted">
            {unpaidCount} unpaid
          </div>
        </div>
        <button
          type="button"
          className="h-11 shrink-0 rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-muted"
          onClick={toggle}
        >
          {hide ? "Show" : "Hide"}
        </button>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Today’s revenue</div>
        <div className="num mt-1 text-2xl">{hide ? "••••" : revenueLabel}</div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Profit</div>
        <div className={`num mt-1 text-2xl ${profitNegative ? "text-red" : "text-green"}`}>
          {hide ? "••••" : profitLabel}
        </div>
      </div>
    </div>
  );
}

function Glyph({ kind }: { kind: ReturnType<typeof weatherGlyph> }) {
  const common = "currentColor";
  if (kind === "sun") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4" fill={common} />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" stroke={common} strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "rain") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 10a5 5 0 0 1 9.5-2A4 4 0 0 1 18 16H8a4 4 0 0 1-1-8Z" stroke={common} strokeWidth="2" />
        <path d="M9 18v2M12 17v3M15 18v2" stroke={common} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "snow") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M6 8l12 8M6 16l12-8" stroke={common} strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "storm") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 10a5 5 0 0 1 9.5-2A4 4 0 0 1 18 15H8" stroke={common} strokeWidth="2" />
        <path d="M11 14l-2 5h3l-1 4 5-7h-3l2-2" fill={common} />
      </svg>
    );
  }
  if (kind === "fog") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 10h16M4 14h16M6 18h12" stroke={common} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 15a5 5 0 0 1 9.5-2A4 4 0 0 1 18 19H8a4 4 0 0 1-1-8Z" stroke={common} strokeWidth="2" />
    </svg>
  );
}

export function WeatherPills({ hours }: { hours: HourPill[] }) {
  return (
    <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
      {hours.map((h, i) => (
        <div
          key={`${h.hour}-${i}`}
          className="flex min-w-[4.4rem] flex-col items-center rounded-2xl bg-panel2 px-3 py-2 text-amber"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{h.hour}</div>
          <div className="my-1">
            <Glyph kind={weatherGlyph(h.code)} />
          </div>
          <div className="num text-lg text-ink">{h.tempF}°</div>
        </div>
      ))}
    </div>
  );
}
