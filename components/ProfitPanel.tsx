import { money, pct } from "@/lib/format";
import type { ProfitResult } from "@/lib/profit";

export function ProfitPanel({ p }: { p: ProfitResult }) {
  const tone = p.profit >= 0 ? "text-green" : "text-red";
  return (
    <section className="panel">
      <div className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-muted">
        Job profit
      </div>
      <div className={`num text-5xl leading-none ${tone}`}>{money(p.profit)}</div>
      <p className="mt-2 text-sm text-muted">
        Invoiced − parts cost − linked receipts. Labor is revenue, not a cost.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Invoiced total</dt>
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
