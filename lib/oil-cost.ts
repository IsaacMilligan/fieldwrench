/** Charge vehicle quarts, not leftover jugs. Total = round(jug × quarts ÷ size, 2). $/qt is display only. */
export function oilChargeCents(jugCostCents: number, jugQt: number, quarts: number): number {
  const jug = Math.round(Number(jugCostCents) || 0);
  const size = Number(jugQt);
  const qt = Number(quarts);
  if (!(jug > 0) || !(size > 0) || !(qt > 0)) return 0;
  return Math.round((jug * qt) / size);
}

export function oilPerQtDollars(jugCostCents: number, jugQt: number): number {
  const jug = Math.round(Number(jugCostCents) || 0);
  const size = Number(jugQt);
  if (!(jug > 0) || !(size > 0)) return 0;
  return jug / 100 / size;
}
