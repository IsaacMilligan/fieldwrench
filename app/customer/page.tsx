import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Mark";
import { getCustomerUser } from "@/lib/supabase/server";
import { listBookingsByEmail } from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";
import { CustomerSignOut } from "./signout";

export const dynamic = "force-dynamic";

export default async function CustomerHome() {
  const user = await getCustomerUser();
  if (!user?.email) redirect("/customer/login");
  const bookings = await listBookingsByEmail(user.email);
  const name = String(user.user_metadata?.name ?? user.email);
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-8">
      <Mark />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase">
        Your driveway
      </h1>
      <p className="mt-2 text-muted">Signed in as {name}</p>
      <Link href="/book" className="tap mt-6 flex items-center justify-center">
        Book a visit
      </Link>
      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Requests
      </h2>
      <ul className="mt-3 space-y-3">
        {bookings.length === 0 ? (
          <li className="panel text-muted">No requests yet.</li>
        ) : (
          bookings.map((b) => (
            <li key={String(b.id)} className="panel">
              <div className="flex justify-between gap-3">
                <div className="font-bold">{String(b.vehicle)}</div>
                <span
                  className={`badge ${
                    b.status === "pending"
                      ? "badge-amber"
                      : b.status === "accepted"
                        ? "badge-green"
                        : "badge-steel"
                  }`}
                >
                  {String(b.status)}
                </span>
              </div>
              <p className="mt-2 text-sm">{String(b.issue)}</p>
              <div className="mt-1 text-sm text-muted">{formatDateTime(b.created_at as string)}</div>
            </li>
          ))
        )}
      </ul>
      <CustomerSignOut />
    </div>
  );
}
