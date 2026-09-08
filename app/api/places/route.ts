import { NextRequest, NextResponse } from "next/server";
import { placeDetails, placesConfigured, suggestPlaces } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!placesConfigured()) {
    return NextResponse.json({ disabled: true, suggestions: [] });
  }
  const id = String(req.nextUrl.searchParams.get("id") ?? "").trim();
  if (id) {
    const one = await placeDetails(id);
    return NextResponse.json({ suggestions: one?.label ? [one] : [] });
  }
  const q = String(req.nextUrl.searchParams.get("q") ?? "");
  if (q.trim().length < 3) return NextResponse.json({ suggestions: [] });
  try {
    const suggestions = await suggestPlaces(q);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("places", e);
    return NextResponse.json({ suggestions: [] });
  }
}
