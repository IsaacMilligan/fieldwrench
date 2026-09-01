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

export const ELECTRIC_ENGINE = "Electric";

export function isElectricEngine(raw: unknown): boolean {
  return /^electric$/i.test(String(raw ?? "").trim());
}

/** Battery-electric only (no ICE). Hybrids / PHEVs are false. */
export function isKnownBev(make: string, model: string): boolean {
  const mk = make.trim().toLowerCase();
  const mo = model.trim().toLowerCase();
  if (mk !== "tesla") return false;
  if (/\bcybertruck\b/.test(mo)) return true;
  if (/\bmodel\s*3\b/.test(mo) || mo === "3") return true;
  if (/\bmodel\s*y\b/.test(mo) || mo === "y") return true;
  if (/\bmodel\s*s\b/.test(mo) || mo === "s") return true;
  if (/\bmodel\s*x\b/.test(mo) || mo === "x") return true;
  return false;
}

export function isVpicBev(row: Record<string, string | undefined>): boolean {
  const level = String(row.ElectrificationLevel ?? "");
  const primary = String(row.FuelTypePrimary ?? "");
  const secondary = String(row.FuelTypeSecondary ?? "");
  const blob = `${level} ${primary} ${secondary}`;
  if (/phev|plug-?in hybrid|strong hev|mild hybrid|\bhev\b|hybrid/i.test(blob) && !/\bbev\b|battery electric/i.test(level)) {
    return false;
  }
  if (/\bbev\b|battery electric/i.test(level)) return true;
  if (/^electric(ity)?$/i.test(primary.trim()) && !secondary.trim()) return true;
  if (isKnownBev(String(row.Make ?? ""), String(row.Model ?? ""))) return true;
  return false;
}

export function bookingYears(): number[] {
  const top = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = top; y >= 1990; y--) years.push(y);
  return years;
}

type VpicList = { Results?: Array<Record<string, unknown>> };

const globalMakes = globalThis as unknown as {
  fwMakes?: { at: number; names: string[] };
  fwMakeIds?: { at: number; ids: Record<string, number> };
};

async function vpicMakeId(make: string): Promise<number | null> {
  const want = make.trim().toLowerCase();
  if (!want) return null;
  const hit = globalMakes.fwMakeIds;
  if (!hit || Date.now() - hit.at > 6 * 60 * 60 * 1000) {
    const ids: Record<string, number> = {};
    const types = ["car", "truck", "mpv"];
    for (const t of types) {
      try {
        const data = (await getJson(`${VPIC}/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`)) as VpicList;
        for (const row of data.Results ?? []) {
          const n = String(row.MakeName ?? row.Make_Name ?? "").trim().toLowerCase();
          const id = Number(row.MakeId ?? row.Make_ID ?? 0);
          if (n && Number.isFinite(id) && id > 0) ids[n] = id;
        }
      } catch {
        /* skip type */
      }
    }
    globalMakes.fwMakeIds = { at: Date.now(), ids };
  }
  const map = globalMakes.fwMakeIds?.ids ?? {};
  if (map[want]) return map[want];
  const chevy = want === "chevy" ? map.chevrolet : null;
  return chevy ?? null;
}

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
  const id = await vpicMakeId(make);
  const url = id
    ? `${VPIC}/GetModelsForMakeIdYear/makeId/${id}/modelyear/${year}?format=json`
    : `${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  const data = (await getJson(url)) as VpicList;
  const names = new Set<string>();
  const want = make.trim().toLowerCase();
  for (const row of data.Results ?? []) {
    const makeName = String(row.Make_Name ?? row.MakeName ?? "").trim().toLowerCase();
    if (makeName && makeName !== want) continue;
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
  if (isKnownBev(make, model)) return [ELECTRIC_ENGINE];
  const found = new Set<string>();

  try {
    const url =
      `${VPIC}/GetCanadianVehicleSpecifications/?year=${year}` +
      `&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&units=US&format=json`;
    const data = (await getJson(url)) as VpicList;
    for (const row of data.Results ?? []) {
      const specs = (row.Specs ?? row.specs) as Array<Record<string, unknown>> | undefined;
      const bag = specs
        ? specs.map((s) => `${s.Name ?? s.name ?? ""} ${s.Value ?? s.value ?? ""}`).join(" ")
        : JSON.stringify(row);
      const liters = bag.match(/(\d+(?:\.\d+)?)\s*L\b/gi) ?? [];
      for (const lit of liters) {
        const n = lit.match(/(\d+(?:\.\d+)?)/);
        if (n) found.add(`${n[1]}L`);
      }
      if (isVpicBev(row as Record<string, string | undefined>)) found.add(ELECTRIC_ENGINE);
      const lab = engineLabel(bag);
      if (lab) found.add(lab);
    }
  } catch {
    /* vPIC specs miss is ok */
  }

  const addFrom = async (epaModel: string) => {
    const url = `${EPA}/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(epaModel)}`;
    const data = await getJson(url);
    for (const it of menuItems(data)) {
      const lab = engineLabel(it.text);
      if (lab) found.add(lab);
    }
  };

  try {
    await addFrom(model);
  } catch {
    /* try EPA model variants */
  }
  if (!found.size) {
    try {
      const menuUrl = `${EPA}/model?year=${year}&make=${encodeURIComponent(make)}`;
      const menu = await getJson(menuUrl);
      const needle = model.toLowerCase();
      const matches = menuItems(menu)
        .map((it) => it.value || it.text)
        .filter((name) => {
          const n = name.toLowerCase();
          return n === needle || n.startsWith(`${needle} `) || n.startsWith(`${needle}-`);
        });
      for (const name of matches.slice(0, 8)) {
        try {
          await addFrom(name);
        } catch {
          /* skip variant */
        }
      }
    } catch {
      /* no EPA menu */
    }
  }

  const list = [...found];
  const liters = list.filter((x) => x !== ELECTRIC_ENGINE);
  if (liters.length) return liters.sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
  if (list.includes(ELECTRIC_ENGINE)) return [ELECTRIC_ENGINE];
  return [];
}
