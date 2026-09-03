import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getShopSpec } from "@/lib/db/queries";
import { vinOk } from "@/lib/format";
import {
  formatVpicBody,
  formatVpicDrive,
  formatVpicEngine,
  formatVpicTrim,
  isVpicBev,
} from "@/lib/vpic";

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
  const engine = formatVpicEngine(row, bev);
  const trim = formatVpicTrim(row);
  const bodyClass = formatVpicBody(row);
  const drive = formatVpicDrive(row);
  const spec = await getShopSpec({ year, make, model, engine }).catch(() => null);
  const oil =
    spec && (spec.oil_qt || spec.oil_viscosity || spec.oil_drain_tq || spec.oil_socket)
      ? {
          qtWithFilter: spec.oil_qt,
          viscosity: spec.oil_viscosity,
          drainTq: spec.oil_drain_tq,
          socket: spec.oil_socket,
        }
      : null;
  return NextResponse.json({
    vin,
    year,
    make,
    model,
    engine,
    trim: trim || spec?.trim || "",
    body: bodyClass || spec?.body || "",
    drive: drive || spec?.drive || "",
    oil,
    bev,
  });
}
