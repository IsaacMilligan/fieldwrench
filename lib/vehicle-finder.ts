/** Vehicle Finder VIN decode (Free) + oil-change (Starter). Soft-fails → null. */

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
  /** VF catalog id from VIN decode; server-only for oil-change. */
  vehicleId: number | null;
};

export type VehicleFinderOil = {
  viscosity: string;
  qtWithFilter: number | null;
  qtWithoutFilter: number | null;
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
  vehicle_id?: number | string | null;
};

type VfOilSpec = {
  viscosity?: string | null;
  oil_type?: string | null;
  capacity_with_filter?: number | string | null;
  capacity_without_filter?: number | string | null;
};

type VfVehicleMatch = {
  id?: number | string | null;
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
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
  const eng = clean(data.engine);
  const m = eng.match(/(\d+(?:\.\d+)?)\s*L(?:\s+(V\d+|I\d+|H\d+))?/i);
  if (m) return [m[0].replace(/\s+/g, " "), fuel].filter(Boolean).join(" ");
  return eng;
}

function apiKey(): string | null {
  return process.env.VEHICLE_FINDER_API_KEY?.trim() || null;
}

function asId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asQt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function vfFetch(path: string): Promise<Response | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.vehicle-finder.com/v1${path}`, {
      headers: { Accept: "application/json", "X-API-Key": key },
      cache: "no-store",
    });
    return res;
  } catch {
    return null;
  }
}

/** Free-tier VIN decode. Returns null to signal soft-fail → NHTSA fallback. */
export async function decodeVinVehicleFinder(vin: string): Promise<VehicleFinderDecode | null> {
  const res = await vfFetch(`/vin/${encodeURIComponent(vin)}`);
  if (!res || !res.ok) return null;

  try {
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
      vehicleId: asId(data.vehicle_id),
    };
  } catch {
    return null;
  }
}

function pickVehicleId(
  matches: VfVehicleMatch[],
  engine?: string | null,
  trim?: string | null,
): number | null {
  const withId = matches
    .map((m) => ({ ...m, id: asId(m.id) }))
    .filter((m): m is VfVehicleMatch & { id: number } => m.id != null);
  if (!withId.length) return null;

  const engN = norm(engine ?? "");
  const trimN = norm(trim ?? "");
  if (engN || trimN) {
    const scored = withId
      .map((m) => {
        let score = 0;
        const mEng = norm(clean(m.engine));
        const mTrim = norm(clean(m.trim));
        if (engN && mEng && (mEng.includes(engN) || engN.includes(mEng))) score += 2;
        if (trimN && mTrim && (mTrim.includes(trimN) || trimN.includes(mTrim))) score += 1;
        return { id: m.id, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) return scored[0].id;
  }
  return withId[0].id;
}

async function resolveVehicleId(q: {
  vehicleId?: number | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  trim?: string | null;
}): Promise<number | null> {
  if (q.vehicleId && q.vehicleId > 0) return q.vehicleId;
  const year = q.year != null && Number.isFinite(q.year) ? Number(q.year) : null;
  const make = clean(q.make);
  const model = clean(q.model);
  if (!year || !make || !model) return null;

  const params = new URLSearchParams({
    year: String(year),
    make,
    model,
  });
  const res = await vfFetch(`/vehicles?${params}`);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as { data?: VfVehicleMatch[] | null };
    const matches = Array.isArray(json.data) ? json.data : [];
    return pickVehicleId(matches, q.engine, q.trim);
  } catch {
    return null;
  }
}

function parseOilPayload(data: unknown): VehicleFinderOil | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as {
    oil_spec?: VfOilSpec | null;
    oil_specs?: VfOilSpec[] | null;
  };
  const spec =
    obj.oil_spec && typeof obj.oil_spec === "object"
      ? obj.oil_spec
      : Array.isArray(obj.oil_specs) && obj.oil_specs[0] && typeof obj.oil_specs[0] === "object"
        ? obj.oil_specs[0]
        : null;
  if (!spec) return null;
  const viscosity = clean(spec.viscosity);
  const qtWithFilter = asQt(spec.capacity_with_filter);
  const qtWithoutFilter = asQt(spec.capacity_without_filter);
  if (!viscosity && qtWithFilter == null && qtWithoutFilter == null) return null;
  return { viscosity, qtWithFilter, qtWithoutFilter };
}

/**
 * Starter oil-change: viscosity + capacity only.
 * Soft-fails on missing key, 401/403/404/429, network, or empty payload.
 */
export async function lookupOilVehicleFinder(q: {
  vehicleId?: number | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  trim?: string | null;
}): Promise<VehicleFinderOil | null> {
  if (!apiKey()) return null;
  const id = await resolveVehicleId(q);
  if (!id) return null;

  const res = await vfFetch(`/vehicles/${id}/oil-change`);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as { data?: unknown };
    return parseOilPayload(json.data);
  } catch {
    return null;
  }
}
