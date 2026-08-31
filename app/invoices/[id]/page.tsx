import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { ensureInvoice, getJobBundle } from "@/lib/db/queries";
import { formatDate, money } from "@/lib/format";
import { PAY_METHODS, PAY_LABEL } from "@/lib/status";
import { InvoiceSheet } from "@/components/InvoiceSheet";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const invoice = await ensureInvoice(id);
  const bundle = await getJobBundle(id);
  if (!bundle) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const share = `${proto}://${host}/i/${invoice.token}`;
  const paid = invoice.status === "paid";

  return (
    <Shell title="Invoice">
      <div className={`panel mb-4 ${paid ? "border-green" : "border-red"}`} style={{ borderWidth: 2 }}>
        <div className={`num text-4xl ${paid ? "text-green" : "text-red"}`}>
          {paid ? "PAID" : "UNPAID"} {money(bundle.profit.invoicedTotal)}
        </div>
        {paid && invoice.paid_method ? (
          <div className="mt-1 text-sm text-muted">
            {PAY_LABEL[invoice.paid_method]} · {formatDate(invoice.paid_at)}
          </div>
        ) : null}
      </div>
      <InvoiceSheet bundle={bundle} invoice={invoice} />
      <div className="mt-6 panel">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-muted">Share link</div>
        <p className="mt-2 break-all font-mono text-sm text-amber">{share}</p>
        <p className="mt-1 text-xs text-muted">Works logged out. Tokenized. Send it to the customer.</p>
      </div>
      {paid ? (
        <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="mark_unpaid" />
          <input type="hidden" name="job_id" value={id} />
          <button className="tap tap-ghost" type="submit">
            Mark unpaid
          </button>
        </form>
      ) : (
        <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="mark_paid" />
          <input type="hidden" name="job_id" value={id} />
          <label className="lbl">Paid how</label>
          <select className="field" name="method" defaultValue="venmo">
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAY_LABEL[m]}
              </option>
            ))}
          </select>
          <button className="tap tap-green mt-3" type="submit">
            Mark paid
          </button>
        </form>
      )}
      <Link href={`/jobs/${id}`} className="tap tap-steel mt-3 flex items-center justify-center">
        Back to job
      </Link>
    </Shell>
  );
}
