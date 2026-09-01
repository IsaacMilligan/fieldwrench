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

/** ISO 3779 check digit (position 9). Scan must pass this; typing still uses vinOk. */
export function vinCheckDigitOk(vin: string): boolean {
  const v = vin.trim().toUpperCase();
  if (!vinOk(v)) return false;
  const map: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = v[i];
    const val = ch >= "0" && ch <= "9" ? Number(ch) : map[ch];
    if (val == null) return false;
    sum += val * weights[i];
  }
  const rem = sum % 11;
  const expect = rem === 10 ? "X" : String(rem);
  return v[8] === expect;
}

export function formatPhone(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(raw ?? "").trim();
}

export function vehicleNoun(n: number): string {
  return n === 1 ? "1 vehicle" : `${n} vehicles`;
}
