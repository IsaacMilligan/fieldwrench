export type ProfitInput = {
  laborCents: number;
  partsCustomerCents: number;
  partsCostCents: number;
  receiptCents: number;
};

export type ProfitResult = {
  invoicedTotal: number;
  partsCost: number;
  receiptExpenses: number;
  profit: number;
  markup: number;
  markupPct: number | null;
};

/** profit = invoiced total - parts cost - linked receipt expenses. Labor is revenue. */
export function computeProfit(input: ProfitInput): ProfitResult {
  const invoicedTotal = input.laborCents + input.partsCustomerCents;
  const partsCost = input.partsCostCents;
  const receiptExpenses = input.receiptCents;
  const profit = invoicedTotal - partsCost - receiptExpenses;
  const markup = input.partsCustomerCents - input.partsCostCents;
  const markupPct =
    input.partsCostCents === 0 ? null : (markup / input.partsCostCents) * 100;
  return {
    invoicedTotal,
    partsCost,
    receiptExpenses,
    profit,
    markup,
    markupPct,
  };
}

export function laborLineCents(line: {
  isFlat: boolean;
  flatCents: number;
  hours: number;
  rateCents: number;
}): number {
  if (line.isFlat) return Math.round(line.flatCents);
  return Math.round(line.hours * line.rateCents);
}

export function partCustomerCents(line: {
  qty: number;
  priceCents?: number;
  price_cents?: number;
}): number {
  return Math.round(line.qty * (line.priceCents ?? line.price_cents ?? 0));
}

export function partCostCents(line: {
  qty: number;
  costCents?: number;
  cost_cents?: number;
}): number {
  return Math.round(line.qty * (line.costCents ?? line.cost_cents ?? 0));
}
