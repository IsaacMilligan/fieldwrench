import { money, pct } from "@/lib/format";
import type { InvoiceMath } from "@/lib/invoice";
import type { ProfitResult } from "@/lib/profit";

export function ProfitPanel({ p }: { p: ProfitResult | InvoiceMath }) {
  const tone = p.profit >= 0 ? "text-green" : "text-red";
  const subtotal = p.subtotal ?? p.invoicedTotal;
  const discountTotal = p.discountTotal ?? 0;
  const partsTax = p.partsTax ?? 0;
  return (
    <section className="panel">
      <div className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-muted">
        Job profit
      </div>
      <div className={`num text-5xl leading-none ${tone}`}>{money(p.profit)}</div>
      <p className="mt-2 text-sm text-muted">
        Profit is invoiced (before parts tax) minus parts cost and receipts. Tax is pass-through.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Subtotal</dt>
          <dd className="num text-xl">{money(subtotal)}</dd>
        </div>
        <div>
          <dt className="text-muted">Discounts</dt>
          <dd className="num text-xl">{money(discountTotal)}</dd>
        </div>
        <div>
          <dt className="text-muted">Parts tax</dt>
          <dd className="num text-xl">{money(partsTax)}</dd>
        </div>
        <div>
          <dt className="text-muted">Invoice total</dt>
          <dd className="num text-xl">{money(p.invoicedTotal)}</dd>
        </div>
        <div>
          <dt className="text-muted">Parts cost</dt>
          <dd className="num text-xl">{money(p.partsCost)}</dd>
        </div>
        <div>
          <dt className="text-muted">Receipt expenses</dt>
          <dd className="num text-xl">{money(p.receiptExpenses)}</dd>
        </div>
        <div>
          <dt className="text-muted">Parts markup</dt>
          <dd className="num text-xl">
            {money(p.markup)} <span className="text-muted text-base">{pct(p.markupPct)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
