import { NextRequest, NextResponse } from "next/server";
import { googlePlacesKey, mapboxToken, placeDetails, suggestPlaces } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mb = mapboxToken();
  const gk = googlePlacesKey();
  if (!mb && !gk) {
    console.error("places missing MAPBOX_TOKEN (and GOOGLE_PLACES_API_KEY)");
    return NextResponse.json({ disabled: true, suggestions: [] });
  }
  const id = String(req.nextUrl.searchParams.get("id") ?? "").trim();
  if (id) {
    try {
      const one = await placeDetails(id);
      return NextResponse.json({ suggestions: one?.label ? [one] : [] });
    } catch (e) {
      console.error("places details", e instanceof Error ? e.message : e);
      return NextResponse.json({ suggestions: [] });
    }
  }
  const q = String(req.nextUrl.searchParams.get("q") ?? "");
  if (q.trim().length < 3) return NextResponse.json({ suggestions: [] });
  try {
    const suggestions = await suggestPlaces(q);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("places mapbox/google error", e instanceof Error ? e.message : e);
    return NextResponse.json({ suggestions: [] });
  }
}
