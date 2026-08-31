import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listCustomers } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireSession();
  const rows = await listCustomers();
  return (
    <Shell title="Customers">
      <Link href="/customers/new" className="tap flex items-center justify-center">
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
