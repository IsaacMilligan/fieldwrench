const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const EPA = "https://www.fueleconomy.gov/ws/rest/vehicle/menu";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "FieldWrench/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  return res.json();
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

export const COMMON_MAKES: { label: string; value: string }[] = [
  { label: "Acura", value: "Acura" },
  { label: "Audi", value: "Audi" },
  { label: "BMW", value: "BMW" },
  { label: "Buick", value: "Buick" },
  { label: "Cadillac", value: "Cadillac" },
  { label: "Chevy", value: "Chevrolet" },
  { label: "Chrysler", value: "Chrysler" },
  { label: "Dodge", value: "Dodge" },
  { label: "Ford", value: "Ford" },
  { label: "GMC", value: "GMC" },
  { label: "Honda", value: "Honda" },
  { label: "Hyundai", value: "Hyundai" },
  { label: "Jeep", value: "Jeep" },
  { label: "Kia", value: "Kia" },
  { label: "Lexus", value: "Lexus" },
  { label: "Lincoln", value: "Lincoln" },
  { label: "Mazda", value: "Mazda" },
  { label: "Mercedes-Benz", value: "Mercedes-Benz" },
  { label: "Nissan", value: "Nissan" },
  { label: "Ram", value: "Ram" },
  { label: "Subaru", value: "Subaru" },
  { label: "Tesla", value: "Tesla" },
  { label: "Toyota", value: "Toyota" },
  { label: "Volkswagen", value: "Volkswagen" },
  { label: "Volvo", value: "Volvo" },
];

export function commonMakeValue(labelOrValue: string): string | null {
  const s = labelOrValue.trim().toLowerCase();
  const hit = COMMON_MAKES.find(
    (m) => m.value.toLowerCase() === s || m.label.toLowerCase() === s,
  );
  return hit?.value ?? null;
}

export function bookingYears(): number[] {
  const top = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = top; y >= 1990; y--) years.push(y);
  return years;
}

type VpicList = { Results?: Array<Record<string, unknown>> };

const globalMakes = globalThis as unknown as { fwMakes?: { at: number; names: string[] } };

export async function vpicMakes(): Promise<string[]> {
  const hit = globalMakes.fwMakes;
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.names;
  const types = ["car", "truck", "mpv"];
  const names = new Set<string>();
  for (const t of types) {
    const data = (await getJson(`${VPIC}/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`)) as VpicList;
    for (const row of data.Results ?? []) {
      const n = String(row.MakeName ?? row.Make_Name ?? "").trim();
      if (n) names.add(titleCase(n));
    }
  }
  const list = [...names].sort((a, b) => a.localeCompare(b));
  globalMakes.fwMakes = { at: Date.now(), names: list };
  return list;
}

export async function vpicModels(year: number, make: string): Promise<string[]> {
  const url = `${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  const data = (await getJson(url)) as VpicList;
  const names = new Set<string>();
  for (const row of data.Results ?? []) {
    const n = String(row.Model_Name ?? row.ModelName ?? "").trim();
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function menuItems(raw: unknown): Array<{ text: string; value: string }> {
  if (!raw || typeof raw !== "object") return [];
  const item = (raw as { menuItem?: unknown }).menuItem;
  if (!item) return [];
  const arr = Array.isArray(item) ? item : [item];
  return arr
    .map((x) => {
      const o = x as { text?: string; value?: string };
      return { text: String(o.text ?? ""), value: String(o.value ?? "") };
    })
    .filter((x) => x.text);
}

function engineLabel(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*L\b/i);
  if (m) return `${m[1]}L`;
  if (/\belectric\b|\bbev\b|\bfcev\b/i.test(text)) return "Electric";
  return null;
}

export async function ymmEngines(year: number, make: string, model: string): Promise<string[]> {
  const url = `${EPA}/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  const data = await getJson(url);
  const found = new Set<string>();
  for (const it of menuItems(data)) {
    const lab = engineLabel(it.text);
    if (lab) found.add(lab);
  }
  const list = [...found];
  list.sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
  return list;
}
