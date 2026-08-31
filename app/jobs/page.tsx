import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { listJobs } from "@/lib/db/queries";
import { formatDateTime, vehicleLabel } from "@/lib/format";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await requireSession();
  const jobs = await listJobs();
  const groups = JOB_STATUSES.map((s) => ({
    status: s,
    items: jobs.filter((j) => j.status === s),
  }));

  return (
    <Shell title="Jobs">
      <Link href="/jobs/new" className="tap flex items-center justify-center">
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
