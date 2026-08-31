import { computeProfit } from "../lib/profit";

const p = computeProfit({
  laborCents: 31250,
  partsCustomerCents: 22600,
  partsCostCents: 12300,
  receiptCents: 8400,
});

const expect = {
  invoicedTotal: 53850,
  partsCost: 12300,
  receiptExpenses: 8400,
  profit: 33150,
  markup: 10300,
};

for (const [k, v] of Object.entries(expect)) {
  const got = p[k as keyof typeof p];
  if (got !== v) {
    console.error(`FAIL ${k}: got ${got} want ${v}`);
    process.exit(1);
  }
}
if (p.markupPct === null || Math.abs(p.markupPct - 10300 / 12300 * 100) > 0.01) {
  console.error("FAIL markupPct", p.markupPct);
  process.exit(1);
}
console.log("profit formula ok", p);
