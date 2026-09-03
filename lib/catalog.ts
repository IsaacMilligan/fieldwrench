export const CATALOG_CATEGORIES = ["Part", "Oil", "Shop"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export type CatalogItem = {
  id: string;
  name: string;
  category: CatalogCategory;
  cost_cents: number;
  price_cents: number;
  jug_qt: number;
  jug_cents: number;
};

export const DEFAULT_CATALOG: { name: string; category: CatalogCategory }[] = [
  { name: "Oil (5 qt jug)", category: "Oil" },
  { name: "Drain plug", category: "Part" },
  { name: "Filter", category: "Part" },
];

export function catalogCategory(raw: unknown): CatalogCategory {
  const s = String(raw ?? "").trim();
  if (s === "Oil" || s === "Shop") return s;
  return "Part";
}

export function isOilCategory(raw: unknown): boolean {
  return catalogCategory(raw) === "Oil";
}

export function mapCatalogRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    category: catalogCategory(row.category),
    cost_cents: Math.round(Number(row.cost_cents) || 0),
    price_cents: Math.round(Number(row.price_cents) || 0),
    jug_qt: Number(row.jug_qt) || 5,
    jug_cents: Math.round(Number(row.jug_cents) || 0),
  };
}
