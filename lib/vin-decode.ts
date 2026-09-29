import { decodeVinVehicleFinder } from "@/lib/vehicle-finder";
import {
  formatVpicBody,
  formatVpicDrive,
  formatVpicEngine,
  formatVpicTrim,
  isVpicBev,
} from "@/lib/vpic";

export type VinDecodeResult = {
  vin: string;
  year: number | null;
  make: string;
  model: string;
  engine: string;
  trim: string;
  body: string;
  drive: string;
  bev: boolean;
  source: "vehicle-finder" | "nhtsa";
  /** VF catalog id when decode came from Vehicle Finder; server-only. */
  vehicleId?: number | null;
};

export type VinDecodeFailure = {
  error: string;
  errorCode?: string;
};

async function decodeVinNhtsa(vin: string): Promise<VinDecodeResult | VinDecodeFailure> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return { error: "NHTSA vPIC did not respond. Try again." };
  }
  const json = (await res.json()) as { Results?: Array<Record<string, string>> };
  const row = json.Results?.[0];
  if (!row) return { error: "No decode result." };

  const year = row.ModelYear ? Number(row.ModelYear) : null;
  const make = row.Make || "";
  const model = row.Model || "";
  const errorCode = row.ErrorCode ?? "";
  if (!make && !model) {
    return {
      error: row.ErrorText || "Invalid VIN — NHTSA could not decode it.",
      errorCode,
    };
  }

  const bev = isVpicBev(row);
  return {
    vin,
    year: year != null && Number.isFinite(year) ? year : null,
    make,
    model,
    engine: formatVpicEngine(row, bev),
    trim: formatVpicTrim(row),
    body: formatVpicBody(row),
    drive: formatVpicDrive(row),
    bev,
    source: "nhtsa",
    vehicleId: null,
  };
}

/**
 * Prefer Vehicle Finder Free when VEHICLE_FINDER_API_KEY is set;
 * soft-fail to NHTSA vPIC otherwise (missing key, plan/rate errors, empty decode).
 */
export async function decodeVin(vin: string): Promise<VinDecodeResult | VinDecodeFailure> {
  const vf = await decodeVinVehicleFinder(vin);
  if (vf && (vf.make || vf.model)) {
    return {
      vin,
      year: vf.year,
      make: vf.make,
      model: vf.model,
      engine: vf.engine,
      trim: vf.trim,
      body: vf.body,
      drive: vf.drive,
      bev: vf.bev,
      source: "vehicle-finder",
      vehicleId: vf.vehicleId,
    };
  }
  return decodeVinNhtsa(vin);
}

export function isVinDecodeFailure(
  result: VinDecodeResult | VinDecodeFailure,
): result is VinDecodeFailure {
  return "error" in result;
}
