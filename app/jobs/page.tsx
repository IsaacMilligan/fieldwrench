import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { listJobs, listCustomers, db } from "@/lib/db/queries";
import { formatDateTime, vehicleLabel } from "@/lib/format";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";
import { NewJobForm } from "./NewJobForm";

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
    const customers = await listCustomers();
    const vehicles = await sql<
      { id: string; customer_id: string; year: number | null; make: string; model: string; engine: string }[]
    >`SELECT id, customer_id, year, make, model, engine FROM vehicles ORDER BY year DESC`;
    return (
      <Shell title="New job">
        <NewJobForm
          customers={customers.map((c) => ({
            id: String(c.id),
            name: String(c.name),
            phone: String(c.phone ?? ""),
            email: String(c.email ?? ""),
          }))}
          vehicles={vehicles.map((v) => ({
            id: String(v.id),
            customer_id: String(v.customer_id),
            year: v.year,
            make: String(v.make ?? ""),
            model: String(v.model ?? ""),
            engine: String(v.engine ?? ""),
          }))}
        />
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
