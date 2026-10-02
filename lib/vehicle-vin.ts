export const DUPLICATE_VIN_MSG = "This vehicle is already on this customer";

/** Trimmed, uppercased VIN for comparison ("" when blank/missing). */
export function normalizeVin(vin: string | null | undefined): string {
  return String(vin ?? "").trim().toUpperCase();
}

/** True when a non-blank VIN already appears among a customer's vehicle VINs. Blank VINs never match. */
export function hasDuplicateVin(vin: string | null | undefined, existing: (string | null | undefined)[]): boolean {
  const v = normalizeVin(vin);
  if (!v) return false;
  return existing.some((e) => normalizeVin(e) === v);
}
