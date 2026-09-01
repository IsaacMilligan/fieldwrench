import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getSettings, listReceipts, listMileage, listJobsLite } from "@/lib/db/queries";
import { denverDateISO, formatDate, money } from "@/lib/format";
import { LeadHoursField } from "./LeadHoursField";

export const dynamic = "force-dynamic";

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  const { tab } = await searchParams;
  const jobs = await listJobsLite();

  if (tab === "receipts") {
    const rows = await listReceipts();
    return (
      <Shell title="Receipts">
        <form action="/api/shop" method="post" className="panel">
            <input type="hidden" name="_op" value="add_receipt" />
          <label className="lbl">Amount $</label>
          <input className="field" name="amount" inputMode="decimal" required />
          <label className="lbl">Vendor</label>
          <input className="field" name="vendor" required />
          <label className="lbl">Category</label>
          <select className="field" name="category" defaultValue="parts">
            <option value="parts">Parts</option>
            <option value="fuel">Fuel</option>
            <option value="shop">Shop</option>
            <option value="other">Other</option>
          </select>
          <label className="lbl">Date</label>
          <input className="field" type="date" name="date" defaultValue={denverDateISO()} />
          <label className="lbl">Link to job (optional)</label>
          <select className="field" name="job_id" defaultValue="">
            <option value="">None</option>
            {jobs.map((j) => (
              <option key={String(j.id)} value={String(j.id)}>
                {String(j.customer_name)} · {String(j.make)} {String(j.model)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted">Linked receipts reduce that job&apos;s profit.</p>
          <button className="tap mt-4" type="submit">Save receipt</button>
        </form>
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={String(r.id)} className="panel flex justify-between gap-3">
              <div>
                <div className="font-bold">{String(r.vendor)}</div>
                <div className="text-sm text-muted">
                  {String(r.category)} · {formatDate(String(r.date))}
                  {r.customer_name ? ` · ${r.customer_name}` : ""}
                </div>
              </div>
              <div className="num text-xl">{money(Number(r.amount_cents))}</div>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  if (tab === "mileage") {
    const settings = await getSettings();
    const { rows, ytd } = await listMileage();
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
        <form action="/api/shop" method="post" className="mt-4 panel">
            <input type="hidden" name="_op" value="add_mileage" />
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
          <button className="tap mt-4" type="submit">Log trip</button>
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

  if (tab === "settings") {
    const s = await getSettings();
    return (
      <Shell title="Settings">
        <form action="/api/shop" method="post" className="panel">
            <input type="hidden" name="_op" value="save_settings" />
          <label className="lbl">Shop name</label>
          <input className="field" name="shop_name" defaultValue={s.shop_name} />
          <label className="lbl">Labor rate $ / hour</label>
          <input className="field" name="labor_rate" defaultValue={(s.labor_rate_cents / 100).toFixed(2)} />
          <label className="lbl">IRS mileage rate (cents)</label>
          <input className="field" name="mileage_rate" defaultValue={String(s.mileage_rate_cents)} />
          <p className="mt-2 text-xs text-muted">
            Default is the current IRS business rate (76¢ from July 1, 2026). You can edit it.
          </p>
          <LeadHoursField value={Number(s.lead_hours ?? 24)} />
          <button className="tap mt-4" type="submit">Save settings</button>
        </form>
        <form action="/api/shop" method="post" className="mt-8">
            <input type="hidden" name="_op" value="reset_demo" />
          <p className="text-sm text-muted">Demo reset wipes the shop book and reloads the sample driveway jobs.</p>
          <button className="tap tap-red mt-3" type="submit">Reset demo data</button>
        </form>
      </Shell>
    );
  }

  const items = [
    ["/customers", "Customers"],
    ["/more?tab=receipts", "Receipts"],
    ["/more?tab=mileage", "Mileage"],
    ["/more?tab=settings", "Settings"],
    ["/book", "Public booking page"],
  ];
  return (
    <Shell title="More">
      <ul className="space-y-3">
        {items.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="tap tap-steel flex items-center justify-center">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <form action="/api/shop" method="post" className="mt-10">
            <input type="hidden" name="_op" value="logout" />
        <button className="tap tap-red" type="submit">Sign out</button>
      </form>
    </Shell>
  );
}
