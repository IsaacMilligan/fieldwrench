/** Charge vehicle quarts, not leftover jugs. Round $/qt to the cent, then × quarts. */
export function oilChargeCents(jugCostCents: number, jugQt: number, quarts: number): number {
  const jug = Math.round(Number(jugCostCents) || 0);
  const size = Number(jugQt);
  const qt = Number(quarts);
  if (!(jug > 0) || !(size > 0) || !(qt > 0)) return 0;
  const perQt = Math.round(jug / size);
  return Math.round(perQt * qt);
}

export function oilPerQtCents(jugCostCents: number, jugQt: number): number {
  const jug = Math.round(Number(jugCostCents) || 0);
  const size = Number(jugQt);
  if (!(jug > 0) || !(size > 0)) return 0;
  return Math.round(jug / size);
}
