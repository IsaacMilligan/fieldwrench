import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getShopOilDefault, getVehicle } from "@/lib/db/queries";
import { vehicleLabel } from "@/lib/format";
import { OilSpecCard } from "@/components/OilSpecCard";
import { VehiclePicker } from "@/app/book/VehiclePicker";
import { VinField } from "@/components/VinField";
import { STATUS_LABEL, type JobStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const data = await getVehicle(id);
  if (!data) notFound();
  const { vehicle, customer, jobs } = data;
  const saved = Number(vehicle.oil_saved) === 1;
  const shop = saved
    ? null
    : await getShopOilDefault({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        engine: vehicle.engine,
      }).catch(() => null);
  return (
    <Shell title="Vehicle">
      <p className="text-muted">
        Owner{" "}
        <Link className="text-amber" href={`/customers/${customer?.id}`}>
          {customer?.name}
        </Link>
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold uppercase">
        {vehicleLabel(vehicle)}
      </h1>
      <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="update_vehicle" />
        <input type="hidden" name="id" value={vehicle.id} />
        <VehiclePicker
          initial={{
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            engine: vehicle.engine,
          }}
        />
        <label className="lbl">Plate</label>
        <input className="field" name="plate" defaultValue={vehicle.plate} />
        <label className="lbl">VIN</label>
        <VinField defaultValue={vehicle.vin} />
        <label className="lbl">Mileage</label>
        <input className="field" name="mileage" defaultValue={vehicle.mileage ?? ""} />
        <label className="lbl">Vehicle history notes</label>
        <textarea className="field min-h-28" name="history_notes" defaultValue={vehicle.history_notes} />
        <p className="mt-2 text-xs text-muted">Shop notes only. This is not Carfax or any third-party history.</p>
        <button className="tap mt-4" type="submit">
          Save vehicle
        </button>
      </form>
      <OilSpecCard
        vehicleId={vehicle.id}
        savedQt={saved ? Number(vehicle.oil_qt) || null : null}
        savedViscosity={saved ? String(vehicle.oil_viscosity ?? "") : ""}
        savedTq={saved ? Number(vehicle.oil_drain_tq) || null : null}
        savedSocket={saved ? String(vehicle.oil_socket ?? "") : ""}
        shopQt={shop?.oil_qt ?? null}
        shopViscosity={shop?.oil_viscosity ?? ""}
        shopTq={shop?.oil_drain_tq ?? null}
        shopSocket={shop?.oil_socket ?? ""}
        engine={vehicle.engine}
      />
      <Link href={`/tools?vehicle=${vehicle.id}&vin=${vehicle.vin}`} className="tap tap-ghost mt-3 flex items-center justify-center">
        Decode VIN
      </Link>
      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        History on this car
      </h2>
      <ul className="mt-3 space-y-2">
        {jobs.map((j) => (
          <li key={String(j.id)}>
            <Link href={`/jobs/${j.id}`} className="panel flex justify-between">
              <span>{String(j.complaint).slice(0, 48) || "Job"}</span>
              <span className="text-sm text-muted">{STATUS_LABEL[j.status as JobStatus]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
