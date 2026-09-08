export type DayHours = { open: boolean; start: string; end: string };

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_HOME_BASE = "9399 Spring Run Pkwy, Eagle Mountain, UT 84005";
/** Used only if Nominatim hasn’t geocoded home base yet. */
export const DEFAULT_HOME_COORDS = { lat: 40.3472, lng: -112.0116 };
export const DEFAULT_RADIUS_MI = 12;
export const DEFAULT_BUFFER_MIN = 45;
/** Typical driveway job length used only to size a day’s capacity. Not a timeslot. */
const JOB_MINUTES = 90;

export const DEFAULT_HOURS: DayHours[] = [
  { open: false, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
  { open: true, start: "08:00", end: "17:00" },
];

function clampTime(raw: string, fallback: string): string {
  const m = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseHours(raw: unknown): DayHours[] {
  let arr: unknown[] = [];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  if (arr.length < 7) return DEFAULT_HOURS.map((d) => ({ ...d }));
  return DEFAULT_HOURS.map((d, i) => {
    const row = (arr[i] ?? {}) as Record<string, unknown>;
    const open = row.open === true || row.open === 1 || row.open === "1";
    return {
      open,
      start: clampTime(String(row.start ?? d.start), d.start),
      end: clampTime(String(row.end ?? d.end), d.end),
    };
  });
}

export function weekdayFromISO(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)).getUTCDay();
}

export function isShopOpenOn(hours: DayHours[], iso: string): boolean {
  const d = hours[weekdayFromISO(iso)];
  if (!d?.open) return false;
  return minutesBetween(d.start, d.end) > 0;
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function maxJobsOnDay(hours: DayHours[], iso: string, bufferMin: number): number {
  const d = hours[weekdayFromISO(iso)];
  if (!d?.open) return 0;
  const open = minutesBetween(d.start, d.end);
  if (open <= 0) return 0;
  const slot = JOB_MINUTES + Math.max(0, bufferMin);
  return Math.max(1, Math.floor(open / slot));
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function addDaysISO(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function windowHour(raw: unknown): number {
  const s = String(raw ?? "").toLowerCase();
  if (s === "morning") return 10;
  if (s === "afternoon") return 14;
  return 12;
}

export function normalizeWindow(raw: unknown): "morning" | "afternoon" | "either" {
  const s = String(raw ?? "").toLowerCase();
  if (s === "morning" || s === "afternoon") return s;
  return "either";
}
