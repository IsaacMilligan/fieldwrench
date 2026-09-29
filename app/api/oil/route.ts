import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { lookupShopOil } from "@/lib/oil-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verified shop oil spec for an exact Y/M/M/engine. Shop Postgres only. */
export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const yearRaw = Number(sp.get("year"));
  try {
    const result = await lookupShopOil({
      year: Number.isFinite(yearRaw) ? yearRaw : null,
      make: sp.get("make"),
      model: sp.get("model"),
      engine: sp.get("engine"),
      bev: sp.get("bev") === "1",
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ status: "none" });
  }
}
