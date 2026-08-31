import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listCustomers } from "@/lib/db/queries";
import { db } from "@/lib/db/queries";
import { createJobAction } from "@/lib/actions";
import { JOB_STATUSES, STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  await requireSession();
  const customers = await listCustomers();
  const sql = await db();
  const vehicles = await sql`
    SELECT v.id, v.customer_id, v.year, v.make, v.model, c.name
    FROM vehicles v JOIN customers c ON c.id = v.customer_id
    ORDER BY c.name, v.year DESC
  `;

  return (
    <Shell title="New job">
      <form action={createJobAction} className="space-y-1">
        <label className="lbl">Customer / vehicle</label>
        <select className="field" name="vehicle_id" required>
          {vehicles.map((v) => (
            <option key={String(v.id)} value={String(v.id)}>
              {String(v.name)} — {v.year} {v.make} {v.model}
            </option>
          ))}
        </select>
        <input type="hidden" name="customer_id" id="customer_id" />
        <p className="text-xs text-muted">
          Pick the vehicle. Customer is attached automatically from that vehicle.
        </p>
        <VehicleCustomerSync
          vehicles={vehicles.map((v) => ({
            id: String(v.id),
            customer_id: String(v.customer_id),
          }))}
        />
        <label className="lbl">Status</label>
        <select className="field" name="status" defaultValue="scheduled">
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="lbl">When</label>
        <input className="field" type="datetime-local" name="scheduled_at" />
        <label className="lbl">Driveway address</label>
        <input className="field" name="address" />
        <label className="lbl">Complaint</label>
        <textarea className="field min-h-28" name="complaint" />
        {customers.length === 0 ? (
          <p className="text-red">Add a customer first.</p>
        ) : null}
        <button className="tap mt-6" type="submit">
          Create job
        </button>
      </form>
    </Shell>
  );
}

function VehicleCustomerSync({
  vehicles,
}: {
  vehicles: { id: string; customer_id: string }[];
}) {
  const map = Object.fromEntries(vehicles.map((v) => [v.id, v.customer_id]));
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function(){
            var map = ${JSON.stringify(map)};
            var sel = document.querySelector('select[name=vehicle_id]');
            var hid = document.querySelector('input[name=customer_id]');
            function sync(){ if(sel&&hid) hid.value = map[sel.value] || ''; }
            if(sel){ sel.addEventListener('change', sync); sync(); }
          })();
        `,
      }}
    />
  );
}
