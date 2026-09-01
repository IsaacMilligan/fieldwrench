import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { homeDashboard } from "@/lib/db/queries";
import { money, preferredDateLabel, vehicleLabel } from "@/lib/format";
import { formatServiceList, parseServiceIds } from "@/lib/services";
import { STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";
import { eagleMountainHours } from "@/lib/weather";
import { GreetingLine, MoneyAmounts, StartsIn, TodayStamp, WeatherPills } from "./home/HomeLive";

export const dynamic = "force-dynamic";

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19 12h2M3 12h2M12 3v2M12 19v2M17.5 6.5l1.4-1.4M5.1 18.9l1.4-1.4M17.5 17.5l1.4 1.4M5.1 5.1l1.4 1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToolIcon({ d }: { d: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const TOOLS = [
  {
    href: "/tools",
    label: "VIN decoder",
    d: "M4 7h16v10H4zM8 7V5h8v2M7 12h4M7 15h10",
  },
  {
    href: "/tools",
    label: "DTC lookup",
    d: "M12 4 4 8v8l8 4 8-4V8l-8-4zM12 12v4",
  },
  {
    href: "/more?tab=receipts",
    label: "Scan receipt",
    d: "M7 3h10l3 4v14H4V7l3-4zM8 13h8M8 17h5",
  },
  {
    href: "/more?tab=mileage",
    label: "Mileage calculator",
    d: "M4 18h16M6 18V8l6-4 6 4v10",
  },
];

export default async function HomePage() {
  await requireSession();
  const dash = await homeDashboard();
  const hours = await eagleMountainHours();
  const nextServices = dash.next ? formatServiceList(parseServiceIds(dash.next.services)) : "";

  return (
    <Shell hideHeader>
      <header className="relative pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/more?tab=settings"
          className="absolute right-0 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-lg text-muted"
          aria-label="Settings"
        >
          <GearIcon />
        </Link>
        <div className="flex flex-col items-center pt-2">
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
            <rect x="2" y="2" width="44" height="44" rx="4" fill="#121410" stroke="#e8a317" strokeWidth="3" />
            <path d="M14 18h8l2 4 6-10 4 2-8 14h-8l-2-4-4 4-2-2 4-8z" fill="#e8a317" />
            <path d="M10 34h28" stroke="#c6ccb8" strokeWidth="3" />
          </svg>
          <div className="mt-2 font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[0.18em] text-amber">
            FIELDWRENCH
          </div>
          <GreetingLine />
        </div>
      </header>

      <section className="panel rounded-2xl">
        <TodayStamp />
        <p className="mt-2 text-sm text-muted">
          {dash.todayCount > 0
            ? `${dash.todayCount} job${dash.todayCount === 1 ? "" : "s"} today`
            : "Nothing dated for today."}
        </p>
        {hours ? <WeatherPills hours={hours} /> : null}
      </section>

      <section className="panel mt-3 rounded-2xl">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Upcoming scheduled work</div>
        {dash.next ? (
          <div className="mt-3">
            {dash.next.kind === "job" && dash.next.scheduledAt ? <StartsIn iso={dash.next.scheduledAt} /> : null}
            <Link href={dash.next.href} className="mt-2 block rounded-xl bg-panel2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{dash.next.customer}</div>
                  {nextServices ? <div className="text-sm text-steel">{nextServices}</div> : null}
                  <div className="text-sm text-muted">
                    {vehicleLabel({
                      year: dash.next.vehicleYear,
                      make: dash.next.make,
                      model: dash.next.model,
                    })}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {dash.next.kind === "job"
                      ? dash.next.scheduledAt
                        ? new Intl.DateTimeFormat("en-US", {
                            timeZone: "America/Denver",
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(dash.next.scheduledAt))
                        : "Time not confirmed"
                      : `Preferred date: ${preferredDateLabel(dash.next.preferredDate)}`}
                  </div>
                </div>
                {dash.next.kind === "job" && dash.next.status in STATUS_LABEL ? (
                  <StatusBadge tone={STATUS_TONE[dash.next.status as JobStatus]}>
                    {STATUS_LABEL[dash.next.status as JobStatus]}
                  </StatusBadge>
                ) : (
                  <span className="badge badge-amber">{dash.next.status}</span>
                )}
              </div>
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-lg font-bold">You’re clear for now.</p>
        )}
      </section>

      <section className="panel mt-3 rounded-2xl">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber">Quick tools</div>
        <p className="mt-1 text-sm text-muted">Fast actions for field work.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {TOOLS.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="flex min-h-24 flex-col items-start justify-center gap-2 rounded-xl bg-panel2 px-3 py-3"
            >
              <span className="text-amber">
                <ToolIcon d={t.d} />
              </span>
              <span className="text-sm font-extrabold leading-tight">{t.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel mt-3 rounded-2xl">
        <MoneyAmounts
          revenueLabel={money(dash.todayRevenue)}
          profitLabel={money(dash.todayProfit)}
          profitNegative={dash.todayProfit < 0}
        />
        {dash.unpaid.length ? (
          <ul className="mt-4 space-y-2">
            {dash.unpaid.map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.job_id}`} className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-3">
                  <div>
                    <div className="font-bold">{i.customer_name}</div>
                    <div className="text-sm text-muted">
                      {vehicleLabel({ year: i.vehicle_year, make: i.make, model: i.model })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-xl text-red">{money(i.total)}</div>
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-red">Unpaid</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Link href="/bookings" className="mt-4 block text-center text-sm font-bold text-muted">
        Bookings inbox
      </Link>
    </Shell>
  );
}
