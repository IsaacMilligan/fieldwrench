import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { dashboardStats, getSettings } from "@/lib/db/queries";
import { formatDateTime, money, vehicleLabel } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";
import { StatusBadge } from "@/components/Mark";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireSession();
  const settings = await getSettings();
  const { jobsToday, unpaid, ytdMiles, weekProfit } = await dashboardStats();
  const mileValue = Math.round(ytdMiles * settings.mileage_rate_cents);

  return (
    <Shell title="Home">
      <p className="text-sm text-muted">Today on the driveway</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="panel">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            This week profit
          </div>
          <div className="num mt-2 text-3xl text-green">{money(weekProfit)}</div>
        </div>
        <div className="panel">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            YTD miles
          </div>
          <div className="num mt-2 text-3xl">{ytdMiles.toFixed(1)}</div>
          <div className="text-xs text-muted">
            @ {settings.mileage_rate_cents}¢ · {money(mileValue)}
          </div>
        </div>
      </div>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Today&apos;s jobs
      </h2>
      <ul className="mt-3 space-y-3">
        {jobsToday.length === 0 ? (
          <li className="panel text-muted">Nothing on the board for today.</li>
        ) : (
          jobsToday.map((j) => (
            <li key={String(j.id)}>
              <Link href={`/jobs/${j.id}`} className="panel block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{String(j.customer_name)}</div>
                    <div className="text-sm text-muted">
                      {vehicleLabel({
                        year: j.vehicle_year as number,
                        make: String(j.make),
                        model: String(j.model),
                      })}
                    </div>
                    <div className="mt-1 text-sm text-steel">{formatDateTime(j.scheduled_at as string)}</div>
                  </div>
                  <StatusBadge tone={STATUS_TONE[j.status as JobStatus]}>
                    {STATUS_LABEL[j.status as JobStatus]}
                  </StatusBadge>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Unpaid invoices
      </h2>
      <ul className="mt-3 space-y-3">
        {unpaid.length === 0 ? (
          <li className="panel text-muted">All caught up.</li>
        ) : (
          unpaid.map((i) => (
            <li key={String(i.id)}>
              <Link href={`/invoices/${i.job_id}`} className="panel flex items-center justify-between">
              <div>
              <div className="font-bold">{i.customer_name}</div>
              <div className="text-sm text-muted">
                {vehicleLabel({
                  year: i.vehicle_year,
                  make: i.make,
                  model: i.model,
                })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl text-red">{money(Number(i.total))}</div>
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-red">Unpaid</div>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      <Link href="/bookings" className="tap tap-ghost mt-8 flex items-center justify-center">
        Bookings inbox
      </Link>
    </Shell>
  );
}
