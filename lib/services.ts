import { formatDate } from "./format";

export type ServiceId =
  | "oil_change"
  | "tire_rotation"
  | "brake_inspection"
  | "brake_job"
  | "battery_test"
  | "air_filter"
  | "cabin_filter"
  | "coolant"
  | "spark_plugs"
  | "diagnostic"
  | "other";

export type ServiceDef = {
  id: ServiceId;
  label: string;
  miles: number | null;
  months: number | null;
};

export const SERVICES: ServiceDef[] = [
  { id: "oil_change", label: "Oil change", miles: 3000, months: 3 },
  { id: "tire_rotation", label: "Tire rotation", miles: 6000, months: 6 },
  { id: "brake_inspection", label: "Brake inspection", miles: 12000, months: 12 },
  { id: "brake_job", label: "Brake job", miles: null, months: null },
  { id: "battery_test", label: "Battery test / replacement", miles: null, months: 12 },
  { id: "air_filter", label: "Air filter", miles: 15000, months: 12 },
  { id: "cabin_filter", label: "Cabin filter", miles: 15000, months: 12 },
  { id: "coolant", label: "Coolant", miles: 30000, months: 24 },
  { id: "spark_plugs", label: "Spark plugs", miles: 30000, months: 36 },
  { id: "diagnostic", label: "Diagnostic / check engine", miles: null, months: null },
  { id: "other", label: "Other", miles: null, months: null },
];

const BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<ServiceId, ServiceDef>;

export function isServiceId(v: string): v is ServiceId {
  return v in BY_ID;
}

export function parseServiceIds(raw: unknown): ServiceId[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter(isServiceId);
  }
  const s = String(raw ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(isServiceId);
  } catch {
    /* comma list */
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(isServiceId);
}

export function serviceLabels(ids: ServiceId[]): string[] {
  return ids.map((id) => BY_ID[id].label);
}

export function formatServiceList(ids: ServiceId[]): string {
  return serviceLabels(ids).join(", ");
}

export function servicesToJson(ids: ServiceId[]): string {
  return JSON.stringify(ids);
}

export type JobServiceSource = {
  services?: unknown;
  complaint?: string;
  work_performed?: string;
  diagnosis?: string;
};

const KEYWORDS: Array<{ id: ServiceId; test: RegExp }> = [
  { id: "cabin_filter", test: /\bcabin filter\b/i },
  { id: "air_filter", test: /\bair filter\b/i },
  { id: "oil_change", test: /\boil\b/i },
  { id: "tire_rotation", test: /\brotat/i },
  { id: "brake_inspection", test: /\bbrake inspect/i },
  { id: "brake_job", test: /\b(pads?|rotors?|brake job|brakes?)\b/i },
  { id: "battery_test", test: /\bbattery\b/i },
  { id: "coolant", test: /\bcoolant\b/i },
  { id: "spark_plugs", test: /\b(spark plugs?|iridium plug|ignition coil)\b/i },
  { id: "diagnostic", test: /\b(misfire|check engine|\bP0\d{3}\b|diagnos)/i },
];

export function servicesOnJob(job: JobServiceSource): ServiceId[] {
  const stored = parseServiceIds(job.services);
  if (stored.length) return stored;
  const blob = `${job.complaint ?? ""} ${job.work_performed ?? ""} ${job.diagnosis ?? ""}`;
  const found: ServiceId[] = [];
  for (const k of KEYWORDS) {
    if (k.test.test(blob) && !found.includes(k.id)) found.push(k.id);
  }
  return found;
}

export type Rec = {
  id: ServiceId;
  label: string;
  overdue: boolean;
  line: string;
};

function addMonthsISO(isoDay: string, months: number): string {
  const [y, m, d] = isoDay.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

function dayISO(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function recommendForVehicle(opts: {
  today: string;
  vehicleMileage: number | null;
  completed: Array<{
    services: ServiceId[];
    date: unknown;
    serviceMileage: number | null;
  }>;
}): { recs: Rec[]; firstOil: boolean } {
  const recs: Rec[] = [];
  let sawOil = false;
  for (const def of SERVICES) {
    if (def.miles == null && def.months == null) continue;
    const hits = opts.completed.filter((j) => j.services.includes(def.id));
    if (def.id === "oil_change" && hits.length) sawOil = true;
    if (!hits.length) continue;
    const last = hits[0];
    const lastDay = dayISO(last.date);
    if (!lastDay) continue;
    const parts: string[] = [];
    let overdue = false;
    if (def.miles != null && last.serviceMileage != null && opts.vehicleMileage != null) {
      const remaining = last.serviceMileage + def.miles - opts.vehicleMileage;
      if (remaining <= 0) {
        overdue = true;
        parts.push("over miles");
      } else {
        parts.push(`in ${remaining.toLocaleString("en-US")} miles`);
      }
    }
    if (def.months != null) {
      const due = addMonthsISO(lastDay, def.months);
      if (opts.today > due) {
        overdue = true;
        parts.push(`was due ${formatDate(due)}`);
      } else {
        parts.push(`by ${formatDate(due)}`);
      }
    }
    if (!parts.length) continue;
    const line = overdue
      ? `OVERDUE — ${def.label}`
      : `Next ${def.label.toLowerCase()} ${parts.join(" or ")}`;
    recs.push({ id: def.id, label: def.label, overdue, line });
  }
  return { recs, firstOil: !sawOil };
}
