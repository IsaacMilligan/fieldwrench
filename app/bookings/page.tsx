import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listBookings } from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";
import { formatServiceList, parseServiceIds } from "@/lib/services";

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
        {rows.map((b) => {
          const ids = parseServiceIds(b.services);
          const services = ids.length ? formatServiceList(ids) : String(b.issue ?? "");
          const notes = String(b.notes ?? "");
          return (
            <li key={String(b.id)} className="panel">
              <div className="flex justify-between gap-3">
                <div className="text-lg font-bold">{String(b.name)}</div>
                <span className={`badge ${b.status === "pending" ? "badge-amber" : b.status === "accepted" ? "badge-green" : "badge-steel"}`}>
                  {String(b.status)}
                </span>
              </div>
              <div className="mt-1 text-sm">{String(b.phone)}</div>
              <div className="text-sm text-muted">{String(b.address)}</div>
              <div className="mt-2 font-bold">
                {b.vehicle_year || b.vehicle_make || b.vehicle_model || b.vehicle_engine
                  ? [b.vehicle_year, b.vehicle_make, b.vehicle_model, b.vehicle_engine].filter(Boolean).join(" ")
                  : String(b.vehicle)}
              </div>
              {b.vehicle_year || b.vehicle_engine ? (
                <div className="mt-1 text-sm text-muted">
                  {[b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(" ")}
                  {b.vehicle_engine ? ` · Engine ${b.vehicle_engine}` : ""}
                </div>
              ) : null}
              <p className="mt-2 text-base font-bold text-amber">{services || "—"}</p>
              {notes ? <p className="mt-1 text-sm">{notes}</p> : null}
              <div className="mt-2 text-sm text-steel">
                Preferred: {String(b.preferred_time) || "—"} · {formatDateTime(b.created_at as string)}
              </div>
              {b.status === "pending" ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <form action="/api/shop" method="post">
                    <input type="hidden" name="_op" value="accept_booking" />
                    <input type="hidden" name="id" value={String(b.id)} />
                    <button className="tap tap-green" type="submit">
                      Accept → job
                    </button>
                  </form>
                  <form action="/api/shop" method="post">
                    <input type="hidden" name="_op" value="dismiss_booking" />
                    <input type="hidden" name="id" value={String(b.id)} />
                    <button className="tap tap-red" type="submit">
                      Dismiss
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
