import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getCustomer } from "@/lib/db/queries";
import { vehicleLabel } from "@/lib/format";
import { VehiclePicker } from "@/app/book/VehiclePicker";
import { VinField } from "@/components/VinField";
import { STATUS_LABEL, type JobStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer, vehicles, jobs } = data;
  return (
    <Shell title="Customer">
      <form action="/api/shop" method="post">
            <input type="hidden" name="_op" value="update_customer" />
        <input type="hidden" name="id" value={customer.id} />
        <label className="lbl">Name</label>
        <input className="field" name="name" defaultValue={customer.name} />
        <label className="lbl">Phone</label>
        <input className="field" name="phone" defaultValue={customer.phone} />
        <label className="lbl">Email</label>
        <input className="field" name="email" defaultValue={customer.email} />
        <label className="lbl">Address</label>
        <input className="field" name="address" defaultValue={customer.address} />
        <label className="lbl">Notes</label>
        <textarea className="field min-h-24" name="notes" defaultValue={customer.notes} />
        <button className="tap mt-4" type="submit">
          Save
        </button>
      </form>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Vehicles
      </h2>
      <form action="/api/shop" method="post" className="mt-3 panel">
            <input type="hidden" name="_op" value="create_vehicle" />
        <input type="hidden" name="customer_id" value={id} />
        <VehiclePicker />
        <label className="lbl">Plate</label>
        <input className="field" name="plate" />
        <label className="lbl">VIN</label>
        <VinField />
        <label className="lbl">Mileage</label>
        <input className="field" name="mileage" inputMode="numeric" />
        <label className="lbl">Vehicle history notes</label>
        <textarea className="field min-h-24" name="history_notes" placeholder="Shop notes only — not Carfax." />
        <button className="tap mt-4" type="submit">
          Add vehicle
        </button>
      </form>
      <ul className="mt-3 space-y-3">
        {vehicles.map((v) => (
          <li key={v.id}>
            <Link href={`/vehicles/${v.id}`} className="panel block">
              <div className="font-bold">{vehicleLabel(v)}</div>
              <div className="text-sm text-muted">
                {v.plate || "No plate"} {v.vin ? `· ${v.vin}` : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Jobs
      </h2>
      <ul className="mt-3 space-y-2">
        {jobs.map((j) => (
          <li key={String(j.id)}>
            <Link href={`/jobs/${j.id}`} className="panel flex justify-between">
              <span>{vehicleLabel({ year: j.vehicle_year as number, make: String(j.make), model: String(j.model) })}</span>
              <span className="text-sm text-muted">{STATUS_LABEL[j.status as JobStatus]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
