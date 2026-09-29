import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getShopSpec } from "@/lib/db/queries";
import { vinOk } from "@/lib/format";
import { decodeVin, isVinDecodeFailure } from "@/lib/vin-decode";

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

  const decoded = await decodeVin(vin);
  if (isVinDecodeFailure(decoded)) {
    return NextResponse.json({
      error: decoded.error,
      ...(decoded.errorCode ? { errorCode: decoded.errorCode } : {}),
    });
  }

  const { year, make, model, engine, trim, body: bodyClass, drive, bev } = decoded;
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
    source: decoded.source,
  });
}
