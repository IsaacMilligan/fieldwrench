import { computeProfit, type ProfitResult } from "./profit";

export type DiscountKind = "percent" | "amount";

export type DiscountInput = {
  id?: string;
  name: string;
  kind: DiscountKind;
  /** percent: 10 means 10%. amount: cents. */
  value: number;
};

export type DiscountLine = { id?: string; name: string; cents: number };

export type InvoiceMath = ProfitResult & {
  subtotal: number;
  discountLines: DiscountLine[];
  discountTotal: number;
  partsTax: number;
  partsTaxRate: number;
};

function kindOf(raw: string): DiscountKind {
  return raw === "amount" ? "amount" : "percent";
}

export function discountCents(subtotal: number, d: DiscountInput): number {
  if (subtotal <= 0) return 0;
  if (d.kind === "percent") {
    const pct = Math.max(0, Number(d.value) || 0);
    return Math.round((subtotal * pct) / 100);
  }
  return Math.max(0, Math.round(Number(d.value) || 0));
}

export function computeInvoice(input: {
  laborCents: number;
  partsCustomerCents: number;
  partsCostCents: number;
  receiptCents: number;
  discounts?: DiscountInput[];
  partsTaxRate?: number;
}): InvoiceMath {
  const labor = Math.max(0, Math.round(input.laborCents));
  const partsCharged = Math.max(0, Math.round(input.partsCustomerCents));
  const subtotal = labor + partsCharged;
  const discountLines: DiscountLine[] = [];
  let discountTotal = 0;
  for (const d of input.discounts ?? []) {
    const cents = discountCents(subtotal, { ...d, kind: kindOf(d.kind) });
    if (!cents && !d.name) continue;
    discountLines.push({ id: d.id, name: d.name || (d.kind === "percent" ? `${d.value}%` : "Discount"), cents });
    discountTotal += cents;
  }
  if (discountTotal > subtotal) discountTotal = subtotal;
  const rate = Math.max(0, Number(input.partsTaxRate) || 0);
  const partsTax = Math.round((partsCharged * rate) / 100);
  const afterDiscount = subtotal - discountTotal;
  const invoicedTotal = afterDiscount + partsTax;
  const base = computeProfit({
    laborCents: labor,
    partsCustomerCents: partsCharged,
    partsCostCents: input.partsCostCents,
    receiptCents: input.receiptCents,
  });
  const profit = afterDiscount - input.partsCostCents - input.receiptCents;
  return {
    ...base,
    invoicedTotal,
    profit,
    subtotal,
    discountLines,
    discountTotal,
    partsTax,
    partsTaxRate: rate,
  };
}
