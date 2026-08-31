import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listReceipts, listJobsLite } from "@/lib/db/queries";
import { addReceiptAction } from "@/lib/actions";
import { denverDateISO, formatDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  await requireSession();
  const rows = await listReceipts();
  const jobs = await listJobsLite();
  return (
    <Shell title="Receipts">
      <form action={addReceiptAction} className="panel">
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
        <button className="tap mt-4" type="submit">
          Save receipt
        </button>
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
