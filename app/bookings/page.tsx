import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listBookings } from "@/lib/db/queries";
import { formatDateTime, formatPhone, preferredDateLabel } from "@/lib/format";
import { formatServiceList, parseServiceIds } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  await requireSession();
  const rows = await listBookings();
  const pending = rows.filter((b) => String(b.status) === "pending");
  const dismissed = rows.filter((b) => String(b.status) === "dismissed");
  const rest = rows.filter((b) => String(b.status) !== "pending" && String(b.status) !== "dismissed");

  function card(b: (typeof rows)[number]) {
    const ids = parseServiceIds(b.services);
    const services = ids.length ? formatServiceList(ids) : String(b.issue ?? "");
    const notes = String(b.notes ?? "");
    return (
      <li key={String(b.id)} className="panel">
        <div className="flex justify-between gap-3">
          <div className="text-lg font-bold">{String(b.name)}</div>
          <span
            className={`badge ${
              b.status === "pending" ? "badge-amber" : b.status === "accepted" ? "badge-green" : "badge-steel"
            }`}
          >
            {String(b.status)}
          </span>
        </div>
        <div className="mt-1 text-sm">{formatPhone(b.phone)}</div>
        <div className="text-sm text-muted">{String(b.address)}</div>
        <div className="mt-2 font-bold">
          {b.vehicle_year || b.vehicle_make || b.vehicle_model
            ? [b.vehicle_year, b.vehicle_make, b.vehicle_model].filter(Boolean).join(" ")
            : String(b.vehicle)}
        </div>
        <div className="mt-1 text-sm text-muted">
          Engine: {String(b.vehicle_engine || "").trim() ? String(b.vehicle_engine) : "not specified"}
        </div>
        <p className="mt-2 text-base font-bold text-amber">{services || "—"}</p>
        {notes ? <p className="mt-1 text-sm">{notes}</p> : null}
        <div className="mt-2 text-sm text-steel">
          Preferred date: {preferredDateLabel(b.preferred_date ?? b.preferred_time)} · {formatDateTime(b.created_at as string)}
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
        {b.status === "dismissed" ? (
          <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="restore_booking" />
            <input type="hidden" name="id" value={String(b.id)} />
            <button className="tap tap-steel" type="submit">
              Restore
            </button>
          </form>
        ) : null}
      </li>
    );
  }

  return (
    <Shell title="Bookings">
      <p className="text-sm text-muted">
        Public form lives at <Link className="text-amber" href="/book">/book</Link>. Accept creates a job.
      </p>
      <h2 className="mt-5 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
        Pending ({pending.length})
      </h2>
      <ul className="mt-3 space-y-4">{pending.length ? pending.map(card) : <li className="text-muted">None waiting.</li>}</ul>
      {rest.length ? (
        <>
          <h2 className="mt-8 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">Accepted</h2>
          <ul className="mt-3 space-y-4">{rest.map(card)}</ul>
        </>
      ) : null}
      <details className="mt-8">
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          Dismissed ({dismissed.length})
        </summary>
        <ul className="mt-3 space-y-4">{dismissed.map(card)}</ul>
      </details>
    </Shell>
  );
}
