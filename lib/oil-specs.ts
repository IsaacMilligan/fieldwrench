export type OilCatalog = {
  qtWithFilter: number | null;
  viscosity: string;
  qtWithoutFilter: number | null;
  viscosityAlt: string;
  oilType: string;
};

export type OilQuery = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  vin?: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function rowFrom(obj: Record<string, unknown>, engineHint = ""): OilCatalog & { engine: string } {
  const qtWith =
    num(obj.oil_capacity_quarts) ??
    num(obj.oil_capacity_with_filter) ??
    num(obj.capacity_quarts) ??
    num(obj.capacity_with_filter) ??
    num(obj.qt_with_filter);
  const vis =
    str(obj.oil_viscosity) ||
    str(obj.viscosity) ||
    str(obj.sae) ||
    str(obj.grade) ||
    str(obj.oil_weight);
  const qtWithout =
    num(obj.oil_capacity_without_filter) ??
    num(obj.capacity_without_filter) ??
    num(obj.qt_without_filter);
  const visAlt = str(obj.oil_viscosity_alt) || str(obj.also_approved) || str(obj.alternate_viscosity);
  const oilType = str(obj.oil_type) || str(obj.type);
  const engine = str(obj.engine) || str(obj.engine_size) || str(obj.displacement) || engineHint;
  return { qtWithFilter: qtWith, viscosity: vis, qtWithoutFilter: qtWithout, viscosityAlt: visAlt, oilType, engine };
}

function engineMatches(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, "");
  const nb = b.toLowerCase().replace(/\s+/g, "");
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function uniqueKey(s: OilCatalog): string {
  return `${s.qtWithFilter ?? ""}|${s.viscosity.toUpperCase()}`;
}

function pick(rows: Array<OilCatalog & { engine: string }>, engine: string): OilCatalog | null {
  const usable = rows.filter((r) => r.qtWithFilter || r.viscosity);
  if (!usable.length) return null;
  const pool = engine
    ? usable.filter((r) => engineMatches(r.engine, engine))
    : usable;
  const list = pool.length ? pool : engine ? [] : usable;
  if (!list.length) return null;
  const uniq = new Map<string, OilCatalog>();
  for (const r of list) uniq.set(uniqueKey(r), r);
  if (uniq.size !== 1) return null;
  const hit = [...uniq.values()][0];
  if (!hit.qtWithFilter && !hit.viscosity) return null;
  return {
    qtWithFilter: hit.qtWithFilter,
    viscosity: hit.viscosity,
    qtWithoutFilter: hit.qtWithoutFilter,
    viscosityAlt: hit.viscosityAlt,
    oilType: hit.oilType,
  };
}

function collect(json: unknown, engine: string): Array<OilCatalog & { engine: string }> {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const buckets = [o, o.data, o.vehicle, o.result, o.spec].filter(
    (x) => x && typeof x === "object" && !Array.isArray(x),
  ) as Record<string, unknown>[];
  const arrays = [o.engines, o.results, o.vehicles, o.specs, o.data].filter(Array.isArray) as unknown[][];
  const rows: Array<OilCatalog & { engine: string }> = [];
  for (const b of buckets) rows.push(rowFrom(b, engine));
  for (const arr of arrays) {
    for (const item of arr) {
      if (item && typeof item === "object") rows.push(rowFrom(item as Record<string, unknown>, engine));
    }
  }
  return rows;
}

export async function lookupOilCatalog(q: OilQuery): Promise<OilCatalog | null> {
  const key = String(process.env.OIL_SPECS_API_KEY ?? "").trim();
  if (!key) return null;
  const base = String(process.env.OIL_SPECS_API_URL ?? "https://411-api.simonwakelin.workers.dev").replace(/\/$/, "");
  const year = q.year && q.year > 1980 ? q.year : 0;
  const make = str(q.make);
  const model = str(q.model);
  const engine = str(q.engine);
  const vin = str(q.vin).toUpperCase();
  const urls: string[] = [];
  if (vin.length === 17) urls.push(`${base}/v1/vin?vin=${encodeURIComponent(vin)}`);
  if (year && make && model) {
    const p = new URLSearchParams({ make, model, year: String(year) });
    if (engine) p.set("engine", engine);
    urls.push(`${base}/v1/vehicle?${p.toString()}`);
  }
  if (!urls.length) return null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const hit = pick(collect(json, engine), engine);
      if (hit) return hit;
    } catch {
      continue;
    }
  }
  return null;
}

export function formatQt(n: number): string {
  const t = Number.isInteger(n) ? n.toFixed(1) : String(n);
  return `${t} qt`;
}
