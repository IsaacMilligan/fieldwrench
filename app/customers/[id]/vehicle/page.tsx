import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { createVehicleAction } from "@/lib/actions";

export default async function NewVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  return (
    <Shell title="Vehicle">
      <form action={createVehicleAction}>
        <input type="hidden" name="customer_id" value={id} />
        <label className="lbl">Year</label>
        <input className="field" name="year" inputMode="numeric" />
        <label className="lbl">Make</label>
        <input className="field" name="make" />
        <label className="lbl">Model</label>
        <input className="field" name="model" />
        <label className="lbl">Plate</label>
        <input className="field" name="plate" />
        <label className="lbl">VIN</label>
        <input className="field font-mono" name="vin" maxLength={17} />
        <label className="lbl">Mileage</label>
        <input className="field" name="mileage" inputMode="numeric" />
        <label className="lbl">Vehicle history notes</label>
        <textarea className="field min-h-28" name="history_notes" placeholder="Shop notes only — not Carfax." />
        <button className="tap mt-6" type="submit">
          Save vehicle
        </button>
      </form>
    </Shell>
  );
}
