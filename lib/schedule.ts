import { DEFAULT_SERVICE_MINUTES, SERVICES, type ServiceId } from "./services";

export type DayHours = { open: boolean; start: string; end: string };

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_HOME_BASE = "9399 Spring Run Pkwy, Eagle Mountain, UT 84005";
/** Used only if Nominatim hasn’t geocoded home base yet. */
export const DEFAULT_HOME_COORDS = { lat: 40.3472, lng: -112.0116 };
export const DEFAULT_RADIUS_MI = 12;
export const DEFAULT_BUFFER_MIN = 45;
export const DEFAULT_SLOT_STEP = 30;
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
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

function toMinutes(hhmm: string): number {
  const [h, m] = clampTime(hhmm, "00:00").split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(n: number): string {
  const h = Math.min(23, Math.max(0, Math.floor(n / 60)));
  const min = Math.min(59, Math.max(0, n % 60));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
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
  const clock = parseStartClock(raw);
  if (clock) return clock.hour;
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

export function clampSlotStep(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 5) return DEFAULT_SLOT_STEP;
  return Math.min(120, n);
}

export function parseServiceDurations(raw: unknown): Record<ServiceId, number> {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  const out = { ...DEFAULT_SERVICE_MINUTES };
  for (const s of SERVICES) {
    const n = Math.round(Number(obj[s.id]));
    if (Number.isFinite(n) && n > 0) out[s.id] = Math.min(480, Math.max(15, n));
  }
  return out;
}

export function bookingDurationMinutes(ids: string[], durations: Record<string, number>): number {
  const sum = ids.reduce((acc, id) => {
    const n = Number(durations[id]);
    return acc + (Number.isFinite(n) && n > 0 ? n : 45);
  }, 0);
  return Math.max(30, sum);
}

export function formatClock(hhmm: string): string {
  const t = clampTime(hhmm, "");
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export function parseStartClock(raw: unknown): { hour: number; minute: number } | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hour: Math.min(23, Number(m[1])), minute: Math.min(59, Number(m[2])) };
}

export function startTimesForDay(
  hours: DayHours[],
  iso: string,
  durationMin: number,
  stepMin: number,
): string[] {
  const d = hours[weekdayFromISO(iso)];
  if (!d?.open) return [];
  const start = toMinutes(d.start);
  const end = toMinutes(d.end);
  const dur = Math.max(30, durationMin);
  const step = clampSlotStep(stepMin);
  const last = end - dur;
  if (last < start) return [];
  const out: string[] = [];
  for (let t = start; t <= last; t += step) out.push(fromMinutes(t));
  return out;
}

export function isValidStartTime(
  hours: DayHours[],
  iso: string,
  start: string,
  durationMin: number,
  stepMin: number,
): boolean {
  return startTimesForDay(hours, iso, durationMin, stepMin).includes(clampTime(start, ""));
}
