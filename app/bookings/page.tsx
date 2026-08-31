import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listBookings } from "@/lib/db/queries";
import { acceptBookingAction, dismissBookingAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requireSession();
  const rows = await listBookings();
  return (
    <Shell title="Bookings">
      <p className="text-sm text-muted">
        Public form lives at <Link className="text-amber" href="/book">/book</Link>. Accept creates a job.
      </p>
      <ul className="mt-4 space-y-4">
        {rows.map((b) => (
          <li key={String(b.id)} className="panel">
            <div className="flex justify-between gap-3">
              <div className="text-lg font-bold">{String(b.name)}</div>
              <span className={`badge ${b.status === "pending" ? "badge-amber" : b.status === "accepted" ? "badge-green" : "badge-steel"}`}>
                {String(b.status)}
              </span>
            </div>
            <div className="mt-1 text-sm">{String(b.phone)}</div>
            <div className="text-sm text-muted">{String(b.address)}</div>
            <div className="mt-2 font-bold">{String(b.vehicle)}</div>
            <p className="mt-1 text-sm">{String(b.issue)}</p>
            <div className="mt-2 text-sm text-steel">
              Preferred: {String(b.preferred_time) || "—"} · {formatDateTime(b.created_at as string)}
            </div>
            {b.status === "pending" ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <form action={acceptBookingAction}>
                  <input type="hidden" name="id" value={String(b.id)} />
                  <button className="tap tap-green" type="submit">
                    Accept → job
                  </button>
                </form>
                <form action={dismissBookingAction}>
                  <input type="hidden" name="id" value={String(b.id)} />
                  <button className="tap tap-red" type="submit">
                    Dismiss
                  </button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
