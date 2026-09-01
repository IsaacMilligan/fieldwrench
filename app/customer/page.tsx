import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Mark";
import { getCustomerUser } from "@/lib/supabase/server";
import { listBookingsByEmail, listCustomerGarage } from "@/lib/db/queries";
import { denverDateISO, formatDate, preferredDateLabel, vehicleLabel } from "@/lib/format";
import { CustomerSignOut } from "./signout";
import {
  formatServiceList,
  parseServiceIds,
  recommendForVehicle,
  servicesOnJob,
} from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function CustomerHome() {
  const user = await getCustomerUser();
  if (!user?.email) redirect("/customer/login");
  const bookings = await listBookingsByEmail(user.email);
  const garage = await listCustomerGarage(user.email);
  const name = String(user.user_metadata?.name ?? user.email);
  const today = denverDateISO();

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
          bookings.map((b) => {
            const ids = parseServiceIds(b.services);
            const services = ids.length ? formatServiceList(ids) : String(b.issue ?? "");
            const notes = String(b.notes ?? "");
            return (
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
                <p className="mt-2 text-sm font-bold text-amber">{services}</p>
                {notes ? <p className="mt-1 text-sm">{notes}</p> : null}
                <div className="mt-1 text-sm text-muted">
                  Preferred date: {preferredDateLabel(b.preferred_date ?? b.preferred_time)}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Service history
      </h2>
      {garage.vehicles.length === 0 ? (
        <div className="mt-3 space-y-2">
          <p className="panel text-muted">No completed jobs on file yet.</p>
          <p className="panel">
            <span className="font-bold">Book your first oil change</span>
            <Link href="/book" className="mt-2 block text-amber">
              Request a visit
            </Link>
          </p>
        </div>
      ) : (
        garage.vehicles.map((v) => {
          const completed = v.jobs.map((j) => ({
            services: servicesOnJob(j),
            date: j.scheduled_at ?? j.created_at,
            serviceMileage: j.service_mileage == null ? null : Number(j.service_mileage),
          }));
          const { recs, firstOil } = recommendForVehicle({
            today,
            vehicleMileage: v.mileage == null ? null : Number(v.mileage),
            completed,
          });
          return (
            <section key={v.id} className="mt-4">
              <h3 className="text-lg font-bold">{vehicleLabel(v)}</h3>
              <p className="text-sm text-muted">
                {v.mileage != null ? `${Number(v.mileage).toLocaleString("en-US")} miles` : "Mileage not recorded"}
              </p>
              <ul className="mt-2 space-y-2">
                {v.jobs.length === 0 ? (
                  <li className="panel text-muted">No history yet.</li>
                ) : (
                  v.jobs.map((j) => {
                    const ids = servicesOnJob(j);
                    const miles = j.service_mileage != null ? Number(j.service_mileage) : null;
                    return (
                      <li key={j.id} className="panel">
                        <div className="font-bold">{formatDate((j.scheduled_at ?? j.created_at) as string)}</div>
                        <div className="mt-1 text-amber">{ids.length ? formatServiceList(ids) : "Completed work"}</div>
                        <div className="mt-1 text-sm text-muted">
                          {miles != null ? `${miles.toLocaleString("en-US")} miles` : "Mileage not recorded"}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <h4 className="mt-4 text-sm font-extrabold uppercase tracking-widest text-muted">Next up</h4>
              {recs.length === 0 && !firstOil ? (
                <p className="mt-2 text-sm text-muted">No history yet — recommendations stay quiet until we do the work.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {firstOil ? (
                    <li className="panel">
                      <div className="font-bold">Book your first oil change</div>
                      <Link href="/book" className="mt-2 inline-block text-amber">
                        Request a visit
                      </Link>
                    </li>
                  ) : null}
                  {recs.map((r) => (
                    <li key={r.id} className={`panel ${r.overdue ? "border-red" : ""}`}>
                      <div className={`font-bold ${r.overdue ? "text-red" : ""}`}>{r.line}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      <CustomerSignOut />
    </div>
  );
}
