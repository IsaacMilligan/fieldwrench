import { DEFAULT_HOME_COORDS } from "./schedule";

export type PlaceSuggestion = {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
};

function mapboxToken(): string {
  return String(process.env.MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || "").trim();
}

function googleKey(): string {
  return String(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

export function placesConfigured(): boolean {
  return Boolean(mapboxToken() || googleKey());
}

export async function suggestPlaces(q: string): Promise<PlaceSuggestion[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 3) return [];
  const { lat, lng } = DEFAULT_HOME_COORDS;
  const mb = mapboxToken();
  if (mb) return suggestMapbox(query, mb, lng, lat);
  const gk = googleKey();
  if (gk) return suggestGoogle(query, gk, lat, lng);
  return [];
}

export async function placeDetails(id: string): Promise<PlaceSuggestion | null> {
  const gk = googleKey();
  if (!gk || !id.startsWith("g:")) return null;
  const placeId = id.slice(2);
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,geometry&key=${encodeURIComponent(gk)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } };
    };
    const r = json.result;
    const lat = Number(r?.geometry?.location?.lat);
    const lng = Number(r?.geometry?.location?.lng);
    return {
      id,
      label: String(r?.formatted_address || "").trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  } catch {
    return null;
  }
}

async function suggestMapbox(q: string, token: string, lng: number, lat: number): Promise<PlaceSuggestion[]> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${encodeURIComponent(token)}&country=US&types=address&autocomplete=true&limit=6` +
    `&proximity=${lng},${lat}&bbox=-114.1,39.8,-110.7,41.1`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: Array<{ id?: string; place_name?: string; center?: [number, number] }>;
  };
  return (json.features ?? []).map((f, i) => ({
    id: String(f.id || `mb-${i}`),
    label: String(f.place_name || "").trim(),
    lng: Array.isArray(f.center) ? Number(f.center[0]) : null,
    lat: Array.isArray(f.center) ? Number(f.center[1]) : null,
  })).filter((s) => s.label);
}

async function suggestGoogle(q: string, key: string, lat: number, lng: number): Promise<PlaceSuggestion[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(key)}&types=address&components=country:us` +
    `&location=${lat},${lng}&radius=50000`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    predictions?: Array<{ place_id?: string; description?: string }>;
  };
  return (json.predictions ?? []).slice(0, 6).map((p, i) => ({
    id: p.place_id ? `g:${p.place_id}` : `g-${i}`,
    label: String(p.description || "").trim(),
    lat: null,
    lng: null,
  })).filter((s) => s.label);
}
