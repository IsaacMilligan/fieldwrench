import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { listJobs, db } from "@/lib/db/queries";
import { createJobAction } from "@/lib/actions";
import { formatDateTime, vehicleLabel } from "@/lib/format";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  if (sp.new) {
    const sql = await db();
    const vehicles = await sql`
      SELECT v.id, v.year, v.make, v.model, c.name
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      ORDER BY c.name, v.year DESC
    `;
    return (
      <Shell title="New job">
        <form action={createJobAction}>
          <label className="lbl">Customer / vehicle</label>
          <select className="field" name="vehicle_id" required>
            {vehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {String(v.name)} — {v.year} {v.make} {v.model}
              </option>
            ))}
          </select>
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
          <button className="tap mt-6" type="submit">
            Create job
          </button>
        </form>
      </Shell>
    );
  }

  const jobs = await listJobs();
  const groups = JOB_STATUSES.map((s) => ({
    status: s,
    items: jobs.filter((j) => j.status === s),
  }));

  return (
    <Shell title="Jobs">
      <Link href="/jobs?new=1" className="tap flex items-center justify-center">
        New job
      </Link>
      {groups.map((g) => (
        <section key={g.status} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
              {STATUS_LABEL[g.status]}
            </h2>
            <span className="num text-muted">{g.items.length}</span>
          </div>
          <ul className="space-y-3">
            {g.items.length === 0 ? (
              <li className="text-sm text-muted">Empty</li>
            ) : (
              g.items.map((j) => (
                <li key={String(j.id)}>
                  <Link href={`/jobs/${j.id}`} className="panel block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold">{String(j.customer_name)}</div>
                        <div className="text-sm text-muted">
                          {vehicleLabel({
                            year: j.vehicle_year as number,
                            make: String(j.make),
                            model: String(j.model),
                          })}
                        </div>
                        <div className="mt-1 text-sm text-steel">{formatDateTime(j.scheduled_at as string)}</div>
                      </div>
                      <StatusBadge tone={STATUS_TONE[j.status as JobStatus]}>
                        {STATUS_LABEL[j.status as JobStatus]}
                      </StatusBadge>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
