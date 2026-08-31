import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getSettings, listMileage, listJobsLite } from "@/lib/db/queries";
import { addMileageAction } from "@/lib/actions";
import { denverDateISO, formatDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MileagePage() {
  await requireSession();
  const settings = await getSettings();
  const { rows, ytd } = await listMileage();
  const jobs = await listJobsLite();
  const value = Math.round(ytd * settings.mileage_rate_cents);
  return (
    <Shell title="Mileage">
      <div className="panel">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">YTD business miles</div>
        <div className="num mt-2 text-5xl">{ytd.toFixed(1)}</div>
        <div className="mt-1 text-sm text-muted">
          IRS rate in settings: {settings.mileage_rate_cents}¢ · {money(value)}
        </div>
      </div>
      <form action={addMileageAction} className="mt-4 panel">
        <label className="lbl">Miles</label>
        <input className="field" name="miles" inputMode="decimal" required />
        <label className="lbl">Purpose</label>
        <input className="field" name="purpose" required />
        <label className="lbl">Date</label>
        <input className="field" type="date" name="date" defaultValue={denverDateISO()} />
        <label className="lbl">Job (optional)</label>
        <select className="field" name="job_id" defaultValue="">
          <option value="">None</option>
          {jobs.map((j) => (
            <option key={String(j.id)} value={String(j.id)}>
              {String(j.customer_name)} · {String(j.make)} {String(j.model)}
            </option>
          ))}
        </select>
        <button className="tap mt-4" type="submit">
          Log trip
        </button>
      </form>
      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={String(r.id)} className="panel flex justify-between">
            <div>
              <div className="font-bold">{String(r.purpose)}</div>
              <div className="text-sm text-muted">
                {formatDate(String(r.date))}
                {r.customer_name ? ` · ${r.customer_name}` : ""}
              </div>
            </div>
            <div className="num text-xl">{Number(r.miles).toFixed(1)}</div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
