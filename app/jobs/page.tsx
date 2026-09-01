import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { listJobs, listCustomers, db } from "@/lib/db/queries";
import { denverDateISO, formatDateTime, vehicleLabel } from "@/lib/format";
import { formatServiceList, parseServiceIds } from "@/lib/services";
import { STATUS_LABEL, STATUS_TONE, type JobStatus } from "@/lib/status";
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
  const today = denverDateISO();
  const active = jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled");
  const done = jobs.filter((j) => j.status === "completed");
  const cancelled = jobs.filter((j) => j.status === "cancelled");

  function row(j: (typeof jobs)[number]) {
    const day = j.scheduled_at ? denverDateISO(new Date(j.scheduled_at as string | Date)) : "";
    const overdue = j.status === "scheduled" && day && day < today;
    const services = formatServiceList(parseServiceIds(j.services));
    return (
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
              {services ? <div className="mt-1 text-sm text-amber">{services}</div> : null}
              <div className="mt-1 text-sm text-steel">{formatDateTime(j.scheduled_at as string)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {overdue ? <span className="badge badge-red">Overdue</span> : null}
              <StatusBadge tone={STATUS_TONE[j.status as JobStatus]}>{STATUS_LABEL[j.status as JobStatus]}</StatusBadge>
            </div>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <Shell title="Jobs">
      <Link href="/jobs?new=1" className="tap flex items-center justify-center">
        New job
      </Link>
      <ul className="mt-5 space-y-3">{active.map(row)}</ul>
      <details className="mt-8">
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          Completed ({done.length})
        </summary>
        <ul className="mt-3 space-y-3">{done.map(row)}</ul>
      </details>
      <details className="mt-8">
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          Cancelled ({cancelled.length})
        </summary>
        <ul className="mt-3 space-y-3">{cancelled.map(row)}</ul>
      </details>
    </Shell>
  );
}
