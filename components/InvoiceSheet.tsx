import { money, vehicleLabel, formatDate } from "@/lib/format";
import { laborLineCents, partCustomerCents } from "@/lib/profit";
import type { getJobBundle, Invoice } from "@/lib/db/queries";

type Bundle = NonNullable<Awaited<ReturnType<typeof getJobBundle>>>;

export function InvoiceSheet({
  bundle,
  invoice,
  shop = "FieldWrench",
}: {
  bundle: Bundle;
  invoice: Invoice;
  shop?: string;
}) {
  const { job, customer, vehicle, labor, parts, profit } = bundle;
  return (
    <article className="panel bg-[#0e100c] print:bg-white print:text-black">
      <header className="flex items-start justify-between border-b-2 border-amber pb-3">
        <div>
          <div className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[0.18em] text-amber">
            {shop.toUpperCase()}
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Driveway auto service
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono">{invoice.id.slice(0, 8).toUpperCase()}</div>
          <div className="text-muted">{formatDate(invoice.created_at)}</div>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Bill to</div>
          <div className="font-bold">{customer?.name}</div>
          <div>{customer?.phone}</div>
          <div className="text-muted">{job.address || customer?.address}</div>
        </div>
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Vehicle</div>
          <div className="font-bold">{vehicleLabel(vehicle ?? {})}</div>
          <div>{vehicle?.plate}</div>
          <div className="font-mono text-xs">{vehicle?.vin}</div>
        </div>
      </div>
      {job.work_performed ? (
        <p className="mt-4 text-sm text-steel">{job.work_performed}</p>
      ) : null}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-muted">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {labor.map((l) => (
            <tr key={l.id} className="border-b border-line/60">
              <td className="py-2">
                {l.description}
                <div className="text-xs text-muted">
                  {l.is_flat ? "Labor (flat)" : `Labor ${l.hours} h`}
                </div>
              </td>
              <td className="num py-2 text-right">
                {money(laborLineCents({
                  isFlat: l.is_flat,
                  flatCents: l.flat_cents,
                  hours: l.hours,
                  rateCents: l.rate_cents,
                }))}
              </td>
            </tr>
          ))}
          {parts.map((p) => (
            <tr key={p.id} className="border-b border-line/60">
              <td className="py-2">
                {p.description}
                <div className="text-xs text-muted">Part × {p.qty}</div>
              </td>
              <td className="num py-2 text-right">{money(partCustomerCents(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between text-lg font-bold">
        <span>Total</span>
        <span className="num text-2xl">{money(profit.invoicedTotal)}</span>
      </div>
    </article>
  );
}
