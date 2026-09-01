import { NextRequest, NextResponse } from "next/server";
import { bookingYears, vpicMakes, vpicModels, ymmEngines } from "@/lib/vpic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year") ?? "");
  const make = String(req.nextUrl.searchParams.get("make") ?? "").trim();
  const model = String(req.nextUrl.searchParams.get("model") ?? "").trim();
  const kind = String(req.nextUrl.searchParams.get("kind") ?? "").trim();

  try {
    if (kind === "years") {
      return NextResponse.json({ ok: true, options: bookingYears().map(String) });
    }
    if (kind === "makes") {
      if (!year) return NextResponse.json({ ok: false, error: "Pick a year first." }, { status: 400 });
      const options = await vpicMakes();
      if (!options.length) return NextResponse.json({ ok: false, error: "No makes returned. Retry." });
      return NextResponse.json({ ok: true, options });
    }
    if (kind === "models") {
      if (!year || !make) return NextResponse.json({ ok: false, error: "Pick year and make first." }, { status: 400 });
      const options = await vpicModels(year, make);
      if (!options.length) {
        return NextResponse.json({ ok: false, error: `No models for ${year} ${make}. Try another make.` });
      }
      return NextResponse.json({ ok: true, options });
    }
    if (kind === "engines") {
      if (!year || !make || !model) {
        return NextResponse.json({ ok: false, error: "Pick year, make, and model first." }, { status: 400 });
      }
      const options = await ymmEngines(year, make, model);
      if (!options.length) {
        return NextResponse.json({ ok: false, error: `No engine sizes for ${year} ${make} ${model}. Retry.` });
      }
      return NextResponse.json({ ok: true, options });
    }
    return NextResponse.json({ ok: false, error: "Unknown lookup." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed.";
    return NextResponse.json({ ok: false, error: msg });
  }
}
