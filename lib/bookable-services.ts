import { DEFAULT_SERVICE_MINUTES, SERVICES } from "./services";

export type BookableService = {
  id: string;
  name: string;
  duration_min: number;
  blurb: string;
  sort_order: number;
  active: boolean;
};

export function clampServiceDuration(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 15) return 45;
  return Math.min(480, n);
}

export function seedBookableServices(): Array<{
  id: string;
  name: string;
  duration_min: number;
  sort_order: number;
}> {
  return SERVICES.map((s, i) => ({
    id: s.id,
    name: s.label,
    duration_min: DEFAULT_SERVICE_MINUTES[s.id] ?? 45,
    sort_order: (i + 1) * 10,
  }));
}

export function durationsFromBookable(rows: BookableService[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.id] = r.duration_min;
  return out;
}

export function labelsFromBookable(ids: string[], rows: BookableService[]): string {
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id) || id).filter(Boolean).join(", ");
}

export function formatDurationLabel(min: number): string {
  const n = Math.max(0, Math.round(Number(min) || 0));
  if (n >= 60 && n % 60 === 0) return `${n / 60} hr`;
  return `${n} min`;
}
