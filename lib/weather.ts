/** Eagle Mountain, UT. Open-Meteo — no key. Fail closed: return null, never invent °F. */

const LAT = 40.3142;
const LON = -112.0066;

export type HourPill = {
  hour: string;
  tempF: number;
  code: number;
};

function wmoOk(code: number) {
  return Number.isFinite(code);
}

function denverWallHour(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour").padStart(2, "0")}:00`;
}

export function weatherGlyph(code: number): "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" {
  if (code === 0 || code === 1) return "sun";
  if (code === 2 || code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}

export async function eagleMountainHours(): Promise<HourPill[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit` +
    `&timezone=America%2FDenver&forecast_days=2`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[] };
    };
    const times = data.hourly?.time;
    const temps = data.hourly?.temperature_2m;
    const codes = data.hourly?.weather_code;
    if (!times?.length || !temps?.length || !codes?.length) return null;
    const nowWall = denverWallHour();
    const out: HourPill[] = [];
    for (let i = 0; i < times.length && out.length < 6; i++) {
      const stamp = times[i];
      if (!stamp || stamp < nowWall) continue;
      const tempF = Math.round(Number(temps[i]));
      const code = Number(codes[i]);
      if (!Number.isFinite(tempF) || !wmoOk(code)) continue;
      const hourPart = stamp.slice(11, 13);
      const hourNum = Number(hourPart);
      if (!Number.isFinite(hourNum)) continue;
      const hour = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: true,
      }).format(new Date(Date.UTC(2020, 0, 1, hourNum)));
      out.push({ hour, tempF, code });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
