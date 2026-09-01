import { NextRequest, NextResponse } from "next/server";
import { bookingYears, vpicMakes, vpicModels, ymmEngines, COMMON_MAKES } from "@/lib/vpic";

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
      return NextResponse.json({
        ok: true,
        options: COMMON_MAKES.map((m) => m.value),
      });
    }
    if (kind === "makes-all") {
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
      try {
        const options = await ymmEngines(year, make, model);
        return NextResponse.json({ ok: true, options });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Lookup failed.";
        return NextResponse.json({ ok: true, options: [], error: msg });
      }
    }
    return NextResponse.json({ ok: false, error: "Unknown lookup." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed.";
    return NextResponse.json({ ok: false, error: msg });
  }
}
