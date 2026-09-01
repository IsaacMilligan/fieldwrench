import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listCustomers } from "@/lib/db/queries";
import { VehiclePicker } from "@/app/book/VehiclePicker";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  if (sp.new) {
    return (
      <Shell title="New customer">
        <form action="/api/shop" method="post">
            <input type="hidden" name="_op" value="create_customer" />
          <label className="lbl">Name</label>
          <input className="field" name="name" required />
          <label className="lbl">Phone</label>
          <input className="field" name="phone" type="tel" />
          <label className="lbl">Email</label>
          <input className="field" name="email" type="email" />
          <label className="lbl">Address</label>
          <input className="field" name="address" />
          <label className="lbl">Notes</label>
          <textarea className="field min-h-24" name="notes" />
          <VehiclePicker />
          <button className="tap mt-6" type="submit">
            Save customer
          </button>
        </form>
      </Shell>
    );
  }
  const rows = await listCustomers();
  return (
    <Shell title="Customers">
      <Link href="/customers?new=1" className="tap flex items-center justify-center">
        New customer
      </Link>
      <ul className="mt-5 space-y-3">
        {rows.map((c) => (
          <li key={String(c.id)}>
            <Link href={`/customers/${c.id}`} className="panel block">
              <div className="text-lg font-bold">{String(c.name)}</div>
              <div className="text-sm text-muted">{String(c.phone)}</div>
              <div className="text-sm text-steel">{Number(c.vehicle_count)} vehicles</div>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
