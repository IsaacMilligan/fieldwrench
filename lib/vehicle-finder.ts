/** Vehicle Finder Free VIN decode (GET /v1/vin/{vin}). Soft-fails → null; no oil/Starter calls. */

import { ELECTRIC_ENGINE } from "@/lib/vpic";

export type VehicleFinderDecode = {
  year: number | null;
  make: string;
  model: string;
  engine: string;
  trim: string;
  body: string;
  drive: string;
  bev: boolean;
};

type VfVinData = {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  body_class?: string | null;
  drive_type?: string | null;
  fuel_type?: string | null;
  displacement_liters?: number | string | null;
  cylinders?: number | string | null;
  engine_config?: string | null;
  vehicle_type?: string | null;
};

function clean(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s || /^(not applicable|n\/a|na|none|unknown|null|-|0)$/i.test(s)) return "";
  return s;
}

function formatDrive(raw: string): string {
  if (!raw) return "";
  if (/awd|all[- ]wheel/i.test(raw)) return "AWD";
  if (/4x4|4wd|4-wheel/i.test(raw)) return "4WD";
  if (/rwd|rear[- ]wheel/i.test(raw)) return "RWD";
  if (/fwd|front[- ]wheel/i.test(raw)) return "FWD";
  if (/4x2/i.test(raw)) return "4x2";
  return raw;
}

function isBev(data: VfVinData): boolean {
  const fuel = clean(data.fuel_type);
  const engine = clean(data.engine);
  const vtype = clean(data.vehicle_type);
  if (/hybrid|phev|plug-?in/i.test(`${fuel} ${engine}`)) return false;
  if (/^electric(ity)?$/i.test(fuel)) return true;
  if (/^electric$/i.test(engine)) return true;
  if (/\bbev\b|battery electric/i.test(`${fuel} ${engine} ${vtype}`)) return true;
  return false;
}

function formatEngine(data: VfVinData, bev: boolean): string {
  if (bev) return ELECTRIC_ENGINE;
  const rawL = clean(data.displacement_liters);
  const disp = rawL ? (/l$/i.test(rawL) ? rawL : `${rawL}L`) : "";
  const cyl = clean(data.cylinders);
  const cfg = clean(data.engine_config);
  let layout = "";
  if (cyl) {
    if (/v[- ]?shaped|^v$/i.test(cfg)) layout = `V${cyl}`;
    else if (/in[- ]?line|straight/i.test(cfg)) layout = `I${cyl}`;
    else if (/flat|horiz|boxer/i.test(cfg)) layout = `H${cyl}`;
    else layout = `${cyl}-cyl`;
  }
  const fuelRaw = clean(data.fuel_type);
  let fuel = "";
  if (fuelRaw) {
    if (/diesel/i.test(fuelRaw)) fuel = "diesel";
    else if (/gasoline|petrol/i.test(fuelRaw)) fuel = "gasoline";
    else if (/flex/i.test(fuelRaw)) fuel = "flex-fuel";
    else if (!/^electric/i.test(fuelRaw)) fuel = fuelRaw.toLowerCase();
  }
  const built = [disp, layout, fuel].filter(Boolean).join(" ");
  if (built) return built;
  // Fallback: shorten free-tier engine string (e.g. "2.5L I4 DOHC 16V" → "2.5L I4")
  const eng = clean(data.engine);
  const m = eng.match(/(\d+(?:\.\d+)?)\s*L(?:\s+(V\d+|I\d+|H\d+))?/i);
  if (m) return [m[0].replace(/\s+/g, " "), fuel].filter(Boolean).join(" ");
  return eng;
}

/** Free-tier VIN decode. Returns null to signal soft-fail → NHTSA fallback. */
export async function decodeVinVehicleFinder(vin: string): Promise<VehicleFinderDecode | null> {
  const key = process.env.VEHICLE_FINDER_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch(`https://api.vehicle-finder.com/v1/vin/${encodeURIComponent(vin)}`, {
      headers: {
        Accept: "application/json",
        "X-API-Key": key,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { data?: VfVinData | null };
    const data = json.data;
    if (!data || typeof data !== "object") return null;

    const yearNum = data.year != null && data.year !== "" ? Number(data.year) : null;
    const year = yearNum != null && Number.isFinite(yearNum) ? yearNum : null;
    const make = clean(data.make);
    const model = clean(data.model);
    if (!make && !model) return null;

    const bev = isBev(data);
    return {
      year,
      make,
      model,
      engine: formatEngine(data, bev),
      trim: clean(data.trim),
      body: clean(data.body_class),
      drive: formatDrive(clean(data.drive_type)),
      bev,
    };
  } catch {
    return null;
  }
}
