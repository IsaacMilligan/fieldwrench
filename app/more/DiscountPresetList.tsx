import { money } from "@/lib/format";
import type { DiscountPreset } from "@/lib/db/queries";

function amountLabel(p: DiscountPreset): string {
  if (p.kind === "amount") return `${money(p.amount_cents)} off`;
  const n = Number(p.pct);
  const s = Number.isInteger(n) ? String(n) : String(n);
  return `${s}%`;
}

export function DiscountPresetList({ presets }: { presets: DiscountPreset[] }) {
  return (
    <>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {presets.map((p) => (
          <li key={p.id} className="py-1">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
                <span className="inline-block w-4 shrink-0 text-sm transition-transform group-open:rotate-90" aria-hidden>
                  ▶
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {p.name} · {amountLabel(p)}
                </span>
              </summary>
              <form action="/api/shop" method="post" className="space-y-2 pb-3 pl-6">
                <input type="hidden" name="_op" value="update_discount_preset" />
                <input type="hidden" name="id" value={p.id} />
                <label className="lbl">Name</label>
                <input className="field" name="name" defaultValue={p.name} />
                <label className="lbl">Type</label>
                <select className="field" name="kind" defaultValue={p.kind}>
                  <option value="percent">Percent %</option>
                  <option value="amount">Amount $</option>
                </select>
                <label className="lbl">Value</label>
                <input
                  className="field"
                  name="value"
                  inputMode="decimal"
                  defaultValue={p.kind === "amount" ? (p.amount_cents / 100).toFixed(2) : String(p.pct)}
                />
                <button className="tap" type="submit">
                  Save preset
                </button>
              </form>
              <form action="/api/shop" method="post" className="pb-3 pl-6">
                <input type="hidden" name="_op" value="delete_discount_preset" />
                <input type="hidden" name="id" value={p.id} />
                <button className="tap tap-red" type="submit">
                  Delete preset
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      <details className="group mt-3 border-t border-line pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          <span className="inline-block w-4 shrink-0 text-sm transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          Add discount
        </summary>
        <form action="/api/shop" method="post" className="space-y-2 pb-2 pl-6">
          <input type="hidden" name="_op" value="add_discount_preset" />
          <label className="lbl">Name</label>
          <input className="field" name="name" placeholder="Military" required />
          <label className="lbl">Type</label>
          <select className="field" name="kind" defaultValue="percent">
            <option value="percent">Percent %</option>
            <option value="amount">Amount $</option>
          </select>
          <label className="lbl">Value</label>
          <input className="field" name="value" inputMode="decimal" placeholder="10 or 20" required />
          <button className="tap mt-2" type="submit">
            Add preset
          </button>
        </form>
      </details>
    </>
  );
}
