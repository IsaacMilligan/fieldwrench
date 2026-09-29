import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getShopSpec } from "@/lib/db/queries";
import { vinOk } from "@/lib/format";
import { lookupOilVehicleFinder } from "@/lib/vehicle-finder";
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

  const { year, make, model, engine, trim, body: bodyClass, drive, bev, vehicleId } = decoded;
  const spec = await getShopSpec({ year, make, model, engine }).catch(() => null);

  const shopVis = (spec?.oil_viscosity ?? "").trim();
  const shopQt = spec?.oil_qt ?? null;
  const shopDrain = spec?.oil_drain_tq ?? null;
  const shopSocket = (spec?.oil_socket ?? "").trim();
  const shopHasVisOrQt = Boolean(shopVis || shopQt != null);

  let viscosity = shopVis;
  let qtWithFilter = shopQt;
  let qtWithoutFilter: number | null = null;
  let oilSource: "shop" | "vehicle-finder" | undefined;

  if (shopHasVisOrQt) {
    oilSource = "shop";
  } else if (!bev) {
    const vfOil = await lookupOilVehicleFinder({
      vehicleId,
      year,
      make,
      model,
      engine,
      trim,
    }).catch(() => null);
    if (vfOil && (vfOil.viscosity || vfOil.qtWithFilter != null)) {
      viscosity = vfOil.viscosity;
      qtWithFilter = vfOil.qtWithFilter;
      qtWithoutFilter = vfOil.qtWithoutFilter;
      oilSource = "vehicle-finder";
    }
  }

  const oil =
    viscosity || qtWithFilter != null || shopDrain != null || shopSocket
      ? {
          qtWithFilter,
          viscosity,
          drainTq: shopDrain,
          socket: shopSocket,
          ...(qtWithoutFilter != null ? { qtWithoutFilter } : {}),
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
    ...(oilSource ? { oilSource } : {}),
  });
}
