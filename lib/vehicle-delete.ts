import { vehicleLabel } from "./format";

/** Confirm text for deleting a vehicle; the VIN part is left out when blank. */
export function vehicleDeleteConfirm(v: { year?: number | null; make?: string | null; model?: string | null; vin?: string | null }): string {
  const vin = String(v.vin ?? "").trim();
  return `Delete ${vehicleLabel(v)}${vin ? ` (VIN ${vin})` : ""}? This can’t be undone.`;
}

/** Block message when jobs still reference the vehicle. */
export function vehicleOnJobsMessage(n: number): string {
  return `This vehicle is on ${n} ${n === 1 ? "job" : "jobs"}, so it can’t be deleted.`;
}
