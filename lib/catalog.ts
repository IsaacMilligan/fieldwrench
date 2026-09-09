import { money } from "./format";

export const CATALOG_TAGS = ["oil", "part", "labor"] as const;
export type CatalogTag = (typeof CATALOG_TAGS)[number];

/** @deprecated use tag; kept on the row for old data */
export const CATALOG_CATEGORIES = ["Part", "Oil", "Shop"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export type CatalogItem = {
  id: string;
  name: string;
  tag: CatalogTag;
  category: CatalogCategory;
  cost_cents: number;
  price_cents: number;
  jug_qt: number;
  jug_cents: number;
};

export const DEFAULT_CATALOG: { name: string; tag: CatalogTag; category: CatalogCategory }[] = [
  { name: "Oil (5 qt jug)", tag: "oil", category: "Oil" },
  { name: "Drain plug", tag: "part", category: "Part" },
  { name: "Filter", tag: "part", category: "Part" },
];

export function catalogTag(raw: unknown, name?: string): CatalogTag {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "oil" || s === "part" || s === "labor") return s;
  if (s === "oil" || String(raw) === "Oil") return "oil";
  if (name) return guessCatalogTag(name);
  return "part";
}

export function guessCatalogTag(name: string): CatalogTag {
  const n = name.trim().toLowerCase();
  if (!n) return "part";
  if (/filter|pads?|rotor|plug|washer|bulb|hardware|battery|cleaner/.test(n)) return "part";
  if (/\blabor\b|restoration|diag(nostic)?/.test(n)) return "labor";
  if (/\bjug\b|\d+w-\d+|engine oil|motor oil/.test(n)) return "oil";
  if (/\boil\b/.test(n) && !/change/.test(n)) return "oil";
  if (/service|hours?|flat (fee|rate)/.test(n)) return "labor";
  return "part";
}

export function categoryForTag(tag: CatalogTag): CatalogCategory {
  return tag === "oil" ? "Oil" : "Part";
}

export function catalogCategory(raw: unknown): CatalogCategory {
  const s = String(raw ?? "").trim();
  if (s === "Oil" || s === "Shop") return s;
  if (s === "oil") return "Oil";
  return "Part";
}

export function isOilTag(raw: unknown): boolean {
  return catalogTag(raw) === "oil";
}

export function isOilCategory(raw: unknown): boolean {
  return catalogCategory(raw) === "Oil" || catalogTag(raw) === "oil";
}

export function isOilItem(item: { tag?: unknown; category?: unknown }): boolean {
  return catalogTag(item.tag) === "oil" || catalogCategory(item.category) === "Oil";
}

export function isLaborItem(item: { tag?: unknown }): boolean {
  return catalogTag(item.tag) === "labor";
}

export function mapCatalogRow(row: Record<string, unknown>): CatalogItem {
  const name = String(row.name ?? "");
  const tag = row.tag != null && String(row.tag).trim()
    ? catalogTag(row.tag, name)
    : catalogCategory(row.category) === "Oil"
      ? "oil"
      : guessCatalogTag(name);
  return {
    id: String(row.id),
    name,
    tag,
    category: categoryForTag(tag),
    cost_cents: Math.round(Number(row.cost_cents) || 0),
    price_cents: Math.round(Number(row.price_cents) || 0),
    jug_qt: Number(row.jug_qt) || 5,
    jug_cents: Math.round(Number(row.jug_cents) || 0),
  };
}

export function catalogInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function catalogListPriceLabel(item: CatalogItem): string {
  if (item.tag === "oil") {
    const jug = item.jug_cents > 0 ? item.jug_cents : item.cost_cents;
    return jug > 0 ? `${money(jug)}/jug` : "—";
  }
  const charged = item.price_cents > item.cost_cents ? item.price_cents : item.cost_cents;
  if (!(charged > 0)) return "—";
  return item.tag === "labor" ? money(charged) : money(charged);
}

export function catalogUnitCents(item: CatalogItem): number {
  if (item.tag === "oil") return item.jug_cents > 0 ? item.jug_cents : item.cost_cents;
  return item.price_cents > item.cost_cents ? item.price_cents : item.cost_cents;
}
