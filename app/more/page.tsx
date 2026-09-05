import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getSettings, listCatalogItems, listDiscountPresets, listReceipts, listMileage, listJobsLite } from "@/lib/db/queries";
import { denverDateISO, formatDate, money } from "@/lib/format";
import { LeadHoursField } from "./LeadHoursField";
import { ThemeToggle } from "./ThemeToggle";
import { ReceiptScanForm } from "./ReceiptScanForm";
import { CatalogList } from "./CatalogList";

export const dynamic = "force-dynamic";

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sess = await requireSession();
  const { tab } = await searchParams;
  const jobs = await listJobsLite();

  if (tab === "receipts") {
    const rows = await listReceipts();
    return (
      <Shell title="Receipts">
        <ReceiptScanForm
          defaultDate={denverDateISO()}
          jobs={jobs.map((j) => ({
            id: String(j.id),
            label: `${String(j.customer_name)} · ${String(j.make)} ${String(j.model)}`,
          }))}
        />
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
    const presets = await listDiscountPresets();
    const catalog = await listCatalogItems();
    return (
      <Shell title="Settings">
        <form action="/api/shop" method="post" className="mb-6">
            <input type="hidden" name="_op" value="logout" />
          <button className="tap tap-red" type="submit">Log out</button>
        </form>
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
          <label className="lbl">Parts tax rate %</label>
          <input
            className="field"
            name="parts_tax_rate"
            inputMode="decimal"
            defaultValue={Number(s.parts_tax_rate) ? String(s.parts_tax_rate) : "0"}
          />
          <p className="mt-2 text-xs text-muted">Utah parts tax. Applies to parts charged, not labor. 0 until you set it.</p>
          <label className="lbl">Oil jug size (qt)</label>
          <input
            className="field"
            name="oil_jug_qt"
            inputMode="decimal"
            defaultValue={String(Number(s.oil_jug_qt) || 5)}
          />
          <label className="lbl">Oil jug cost $</label>
          <input
            className="field"
            name="oil_jug_cost"
            inputMode="decimal"
            defaultValue={Number(s.oil_jug_cents) > 0 ? (Number(s.oil_jug_cents) / 100).toFixed(2) : ""}
            placeholder="30.03"
          />
          <p className="mt-2 text-xs text-muted">
            Default jug size and last jug price for Oil catalog items. Jobs charge vehicle quarts × jug ÷ size, rounded once. Leftover stays shop oil.
          </p>
          <button className="tap mt-4" type="submit">Save settings</button>
        </form>
        <section className="panel mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
            Item catalog
          </h2>
          <p className="mt-2 text-sm text-muted">
            Search these on the job. Blank customer price bills at cost. Oil items use jug size and jug cost — leftover oil stays shop inventory.
          </p>
          <div className="mt-3">
            <CatalogList items={catalog} />
          </div>
        </section>
        <section className="panel mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
            Discount presets
          </h2>
          <p className="mt-2 text-sm text-muted">Named % or $ off a job. Pick them on the job, or add a one-off there that is not saved here.</p>
          <ul className="mt-3 space-y-3">
            {presets.map((p) => (
              <li key={p.id} className="border-t border-line pt-3">
                <form action="/api/shop" method="post" className="space-y-2">
                  <input type="hidden" name="_op" value="update_discount_preset" />
                  <input type="hidden" name="id" value={p.id} />
                  <input className="field" name="name" defaultValue={p.name} />
                  <select className="field" name="kind" defaultValue={p.kind}>
                    <option value="percent">Percent %</option>
                    <option value="amount">Amount $</option>
                  </select>
                  <input
                    className="field"
                    name="value"
                    inputMode="decimal"
                    defaultValue={p.kind === "amount" ? (p.amount_cents / 100).toFixed(2) : String(p.pct)}
                  />
                  <button className="tap" type="submit">Save preset</button>
                </form>
                <form action="/api/shop" method="post" className="mt-2">
                  <input type="hidden" name="_op" value="delete_discount_preset" />
                  <input type="hidden" name="id" value={p.id} />
                  <button className="tap tap-red" type="submit">Delete preset</button>
                </form>
              </li>
            ))}
          </ul>
          <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="add_discount_preset" />
            <label className="lbl">New preset name</label>
            <input className="field" name="name" placeholder="Military" required />
            <label className="lbl">Type</label>
            <select className="field" name="kind" defaultValue="percent">
              <option value="percent">Percent %</option>
              <option value="amount">Amount $</option>
            </select>
            <label className="lbl">Value</label>
            <input className="field" name="value" inputMode="decimal" placeholder="10 or 20" required />
            <button className="tap mt-3" type="submit">Add preset</button>
          </form>
        </section>
        <ThemeToggle value={s.theme === "dark" ? "dark" : "light"} />
        {sess.isDemo ? (
        <form action="/api/shop" method="post" className="mt-8">
            <input type="hidden" name="_op" value="reset_demo" />
          <p className="text-sm text-muted">Demo reset wipes the demo shop only and reloads sample driveway jobs. It does not touch a real mechanic account.</p>
          <button className="tap tap-red mt-3" type="submit">Reset demo data</button>
        </form>
        ) : null}
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
