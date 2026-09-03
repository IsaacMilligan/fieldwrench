import { computeProfit, partCustomerCents } from "../lib/profit";
import { computeInvoice } from "../lib/invoice";
import { oilChargeCents } from "../lib/oil-cost";

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
if (p.markupPct === null || Math.abs(p.markupPct - (10300 / 12300) * 100) > 0.01) {
  console.error("FAIL markupPct", p.markupPct);
  process.exit(1);
}
console.log("profit formula ok", p);

const billed = partCustomerCents({ qty: 1, price_cents: 0, cost_cents: 4394 });
if (billed !== 4394) {
  console.error("FAIL bill-at-cost", billed);
  process.exit(1);
}
const atCost = computeProfit({
  laborCents: 7000,
  partsCustomerCents: billed,
  partsCostCents: 4394,
  receiptCents: 0,
});
if (atCost.invoicedTotal !== 11394 || atCost.profit !== 7000 || atCost.markup !== 0) {
  console.error("FAIL 70+43.94", atCost);
  process.exit(1);
}
console.log("bill at cost ok", atCost);

const inv = computeInvoice({
  laborCents: 7000,
  partsCustomerCents: 4394,
  partsCostCents: 4394,
  receiptCents: 0,
  discounts: [{ name: "Military", kind: "percent", value: 10 }],
  partsTaxRate: 7.45,
});
if (inv.subtotal !== 11394) {
  console.error("FAIL subtotal", inv.subtotal);
  process.exit(1);
}
if (inv.discountTotal !== 1139) {
  console.error("FAIL discount", inv.discountTotal);
  process.exit(1);
}
if (inv.partsTax !== 327) {
  console.error("FAIL tax", inv.partsTax);
  process.exit(1);
}
if (inv.invoicedTotal !== 11394 - 1139 + 327) {
  console.error("FAIL grand", inv.invoicedTotal);
  process.exit(1);
}
if (inv.profit !== 11394 - 1139 - 4394) {
  console.error("FAIL profit-ex-tax", inv.profit);
  process.exit(1);
}
console.log("invoice discounts+tax ok", inv);

const oilFull = oilChargeCents(2817, 5, 5);
if (oilFull !== 2817) {
  console.error("FAIL full jug 28.17", oilFull);
  process.exit(1);
}
const oil = oilChargeCents(2817, 5, 6.9);
if (oil !== Math.round((2817 * 6.9) / 5)) {
  console.error("FAIL oil 6.9 from 28.17/5", oil);
  process.exit(1);
}
console.log("oil jug math ok", oilFull, oil);
