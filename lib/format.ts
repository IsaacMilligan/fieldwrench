export const TZ = "America/Denver";

export function money(cents: number): string {
  const n = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return n;
}

export function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}

export function parseNumber(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function denverDateISO(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function normalizeLeadHours(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 24;
  return Math.min(168, Math.max(0, n));
}

/** Denver calendar date of (now + lead hours). That day is the first selectable day. */
export function earliestBookDateISO(leadHours: number, now = new Date()): string {
  const hours = normalizeLeadHours(leadHours);
  return denverDateISO(new Date(now.getTime() + hours * 60 * 60 * 1000));
}

export function preferredDateLabel(raw: unknown): string {
  if (raw == null || raw === "") return "not set";
  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    y = raw.getUTCFullYear();
    m = raw.getUTCMonth() + 1;
    d = raw.getUTCDate();
  } else {
    const s = String(raw).trim();
    const day = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (day) {
      y = Number(day[1]);
      m = Number(day[2]);
      d = Number(day[3]);
    }
  }
  if (!y || !m || !d) return "not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 18, 0, 0)));
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) {
    return String(iso).slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function pct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%`;
}

export function vehicleLabel(v: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
}

export function vinOk(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim());
}
