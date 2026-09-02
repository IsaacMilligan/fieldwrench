import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { vinOk } from "@/lib/format";
import { ELECTRIC_ENGINE, isVpicBev } from "@/lib/vpic";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = (await req.json()) as { vin?: string };
  const vin = String(body.vin ?? "").trim().toUpperCase();
  if (!vinOk(vin)) {
    return NextResponse.json({
      error: "VIN must be 17 characters. Letters I, O, and Q are not used.",
    });
  }
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "NHTSA vPIC did not respond. Try again." }, { status: 502 });
  }
  const json = (await res.json()) as { Results?: Array<Record<string, string>> };
  const row = json.Results?.[0];
  if (!row) return NextResponse.json({ error: "No decode result." });
  const year = row.ModelYear ? Number(row.ModelYear) : null;
  const make = row.Make || "";
  const model = row.Model || "";
  const errorCode = row.ErrorCode ?? "";
  if (!make && !model) {
    return NextResponse.json({
      error: row.ErrorText || "Invalid VIN — NHTSA could not decode it.",
      errorCode,
    });
  }
  const bev = isVpicBev(row);
  const displacement = String(row.DisplacementL ?? "").trim();
  const engine = bev
    ? ELECTRIC_ENGINE
    : displacement
      ? displacement.toUpperCase().endsWith("L")
        ? displacement
        : `${displacement}L`
      : "";
  return NextResponse.json({ vin, year, make, model, engine, oil: null, bev });
}
