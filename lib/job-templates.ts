export type TemplateServiceType = "oil_change" | "brakes" | "headlights" | "battery" | "custom";
export type TemplateLineKind = "labor" | "part" | "checklist" | "oil";

export type JobTemplateLine = {
  id: string;
  template_id: string;
  kind: TemplateLineKind;
  catalog_item_id: string | null;
  catalog_match: string;
  label: string;
  qty: number;
  unit_price_cents: number | null;
  sort_order: number;
  optional: boolean;
};

export type JobTemplate = {
  id: string;
  name: string;
  slug: string;
  service_type: TemplateServiceType;
  default_labor_cents: number;
  price_range_label: string;
  notes: string;
  sort_order: number;
  active: boolean;
  lines: JobTemplateLine[];
};

export type SeedLine = {
  kind: TemplateLineKind;
  label: string;
  catalog_match?: string;
  qty?: number;
  optional?: boolean;
};

export type SeedTemplate = {
  slug: string;
  name: string;
  service_type: TemplateServiceType;
  default_labor_cents: number;
  price_range_label: string;
  notes: string;
  sort_order: number;
  lines: SeedLine[];
};

export const TEMPLATE_CATALOG_EXTRAS: { name: string; category: "Part" | "Oil" | "Shop" }[] = [
  { name: "Oil (5 qt jug)", category: "Oil" },
  { name: "Filter", category: "Part" },
  { name: "Drain plug washer", category: "Part" },
  { name: "Brake pads", category: "Part" },
  { name: "Rotors", category: "Part" },
  { name: "Brake cleaner", category: "Shop" },
  { name: "Brake hardware", category: "Part" },
  { name: "Battery", category: "Part" },
  { name: "Headlight kit", category: "Shop" },
];

export const DEFAULT_JOB_TEMPLATES: SeedTemplate[] = [
  {
    slug: "oil-change",
    name: "Oil change",
    service_type: "oil_change",
    default_labor_cents: 7000,
    price_range_label: "$110–$145",
    notes: "Depends on the car. Quote higher for trucks that take more oil.",
    sort_order: 10,
    lines: [
      { kind: "oil", label: "Engine oil", catalog_match: "Oil (5 qt jug)" },
      { kind: "part", label: "Oil filter", catalog_match: "Filter" },
      { kind: "checklist", label: "Drain plug washer", catalog_match: "Drain plug washer", optional: true },
    ],
  },
  {
    slug: "brakes",
    name: "Brake job",
    service_type: "brakes",
    default_labor_cents: 17500,
    price_range_label: "$340–$400 / axle",
    notes: "If rotors are still good, pads only. Waiting on parts can come in under $300.",
    sort_order: 20,
    lines: [
      { kind: "part", label: "Brake pads", catalog_match: "Brake pads" },
      { kind: "part", label: "Rotors", catalog_match: "Rotors", optional: true },
      { kind: "checklist", label: "Brake cleaner", catalog_match: "Brake cleaner", optional: true },
      { kind: "checklist", label: "Hardware", catalog_match: "Brake hardware", optional: true },
    ],
  },
  {
    slug: "headlights",
    name: "Headlight restoration",
    service_type: "headlights",
    default_labor_cents: 7500,
    price_range_label: "$75 both lights",
    notes: "Sand, polish, and ceramic-seal yellowed lenses. ~30–45 min.",
    sort_order: 30,
    lines: [{ kind: "checklist", label: "Headlight kit / supplies", catalog_match: "Headlight kit", optional: true }],
  },
  {
    slug: "battery",
    name: "Battery replacement",
    service_type: "battery",
    default_labor_cents: 5000,
    price_range_label: "$180–$280",
    notes: "Test charging system before selling a battery.",
    sort_order: 40,
    lines: [{ kind: "part", label: "Battery", catalog_match: "Battery" }],
  },
];

export function templateKind(raw: unknown): TemplateLineKind {
  const s = String(raw ?? "").trim();
  if (s === "labor" || s === "checklist" || s === "oil") return s;
  return "part";
}

export function templateServiceType(raw: unknown): TemplateServiceType {
  const s = String(raw ?? "").trim();
  if (s === "oil_change" || s === "brakes" || s === "headlights" || s === "battery") return s;
  return "custom";
}

export function serviceIdForTemplate(t: TemplateServiceType): "oil_change" | "brake_job" | "battery_test" | null {
  if (t === "oil_change") return "oil_change";
  if (t === "brakes") return "brake_job";
  if (t === "battery") return "battery_test";
  return null;
}
