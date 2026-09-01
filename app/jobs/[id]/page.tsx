import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProfitPanel } from "@/components/ProfitPanel";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { getJobBundle } from "@/lib/db/queries";
import { formatDateTime, money, vehicleLabel } from "@/lib/format";
import { OilSpecCard } from "@/components/OilSpecCard";
import { lookupOilCatalog } from "@/lib/oil-specs";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { laborLineCents, partCostCents, partCustomerCents } from "@/lib/profit";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const bundle = await getJobBundle(id);
  if (!bundle) notFound();
  const { job, customer, vehicle, labor, parts, photos, invoice, receipts, profit } = bundle;
  const scheduled = job.scheduled_at
    ? new Date(job.scheduled_at).toISOString().slice(0, 16)
    : "";
  const catalog = vehicle
    ? await lookupOilCatalog({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        engine: vehicle.engine,
        vin: vehicle.vin,
      }).catch(() => null)
    : null;
  const saved = vehicle ? Number(vehicle.oil_saved) === 1 : false;

  return (
    <Shell title="Job">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/customers/${customer?.id}`} className="text-lg font-bold text-amber">
            {customer?.name}
          </Link>
          <div className="text-muted">
            <Link href={`/vehicles/${vehicle?.id}`}>
              {vehicleLabel(vehicle ?? {})} {vehicle?.plate ? `· ${vehicle.plate}` : ""}
            </Link>
          </div>
        </div>
        <StatusBadge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</StatusBadge>
      </div>
      {vehicle ? (
        <OilSpecCard
          compact
          vehicleId={vehicle.id}
          next={`/jobs/${job.id}`}
          catalog={catalog}
          savedQt={saved ? Number(vehicle.oil_qt) || null : null}
          savedViscosity={saved ? String(vehicle.oil_viscosity ?? "") : ""}
          savedQtWithout={saved ? Number(vehicle.oil_qt_without) || null : null}
          savedViscosityAlt={saved ? String(vehicle.oil_viscosity_alt ?? "") : ""}
          engine={vehicle.engine}
        />
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {JOB_STATUSES.map((s) => (
          <form action="/api/shop" method="post" key={s}>
            <input type="hidden" name="_op" value="set_status" />
            <input type="hidden" name="id" value={job.id} />
            <input type="hidden" name="status" value={s} />
            <button
              className={`tap ${job.status === s ? "" : "tap-steel"}`}
              type="submit"
            >
              {STATUS_LABEL[s]}
            </button>
          </form>
        ))}
      </div>

      <div className="mt-6">
        <ProfitPanel p={profit} />
      </div>

      <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="open_invoice" />
        <input type="hidden" name="job_id" value={job.id} />
        <button className="tap tap-ghost" type="submit">
          Invoice {invoice?.status === "paid" ? "(paid)" : "(unpaid)"}
        </button>
      </form>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Notes
      </h2>
      <form action="/api/shop" method="post" className="mt-2">
            <input type="hidden" name="_op" value="update_job" />
        <input type="hidden" name="id" value={job.id} />
        <input type="hidden" name="status" value={job.status} />
        <label className="lbl">When</label>
        <input className="field" type="datetime-local" name="scheduled_at" defaultValue={scheduled} />
        <label className="lbl">Address</label>
        <input className="field" name="address" defaultValue={job.address} />
        <label className="lbl">Complaint</label>
        <textarea className="field min-h-24" name="complaint" defaultValue={job.complaint} />
        <label className="lbl">Diagnosis</label>
        <textarea className="field min-h-24" name="diagnosis" defaultValue={job.diagnosis} />
        <label className="lbl">Work performed</label>
        <textarea className="field min-h-24" name="work_performed" defaultValue={job.work_performed} />
        <button className="tap mt-4" type="submit">
          Save notes
        </button>
      </form>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Labor
      </h2>
      <ul className="mt-3 space-y-2">
        {labor.map((l) => (
          <li key={l.id} className="panel flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">{l.description}</div>
              <div className="text-sm text-muted">
                {l.is_flat
                  ? `Flat ${money(l.flat_cents)}`
                  : `${l.hours} h × ${money(l.rate_cents)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-xl">{money(laborLineCents({
                isFlat: l.is_flat,
                flatCents: l.flat_cents,
                hours: l.hours,
                rateCents: l.rate_cents,
              }))}</div>
              <form action="/api/shop" method="post">
            <input type="hidden" name="_op" value="delete_labor" />
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="job_id" value={job.id} />
                <button className="text-xs font-bold uppercase tracking-widest text-red" type="submit">
                  Remove
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <form action="/api/shop" method="post" className="mt-3 panel">
            <input type="hidden" name="_op" value="add_labor" />
        <input type="hidden" name="job_id" value={job.id} />
        <label className="lbl">Description</label>
        <input className="field" name="description" placeholder="Driveway labor" />
        <label className="lbl">Mode</label>
        <select className="field" name="mode" defaultValue="hours">
          <option value="hours">Hours × rate</option>
          <option value="flat">Flat fee</option>
        </select>
        <label className="lbl">Hours</label>
        <input className="field" name="hours" inputMode="decimal" placeholder="1.5" />
        <label className="lbl">Hourly rate $</label>
        <input className="field" name="rate" inputMode="decimal" placeholder="125" />
        <label className="lbl">Flat $</label>
        <input className="field" name="flat" inputMode="decimal" placeholder="85" />
        <button className="tap mt-4" type="submit">
          Add labor
        </button>
      </form>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Parts
      </h2>
      <ul className="mt-3 space-y-2">
        {parts.map((p) => (
          <li key={p.id} className="panel">
            <div className="flex justify-between gap-3">
              <div className="font-bold">{p.description}</div>
              <form action="/api/shop" method="post">
            <input type="hidden" name="_op" value="delete_part" />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="job_id" value={job.id} />
                <button className="text-xs font-bold uppercase tracking-widest text-red" type="submit">
                  Remove
                </button>
              </form>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-sm text-muted">
              <div>Qty {p.qty}</div>
              <div>Cost {money(partCostCents({ qty: p.qty, costCents: p.cost_cents }))}</div>
              <div>Price {money(partCustomerCents(p))}</div>
            </div>
          </li>
        ))}
      </ul>
      <form action="/api/shop" method="post" className="mt-3 panel">
            <input type="hidden" name="_op" value="add_part" />
        <input type="hidden" name="job_id" value={job.id} />
        <label className="lbl">Part</label>
        <input className="field" name="description" placeholder="Front pads" />
        <label className="lbl">Qty</label>
        <input className="field" name="qty" inputMode="decimal" defaultValue="1" />
        <label className="lbl">Your cost $</label>
        <input className="field" name="cost" inputMode="decimal" />
        <label className="lbl">Customer price $</label>
        <input className="field" name="price" inputMode="decimal" />
        <button className="tap mt-4" type="submit">
          Add part
        </button>
      </form>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Photos
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((ph) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={ph.id}
            src={ph.url || `/api/media/${ph.id}`}
            alt="Job photo"
            className="h-36 w-full rounded object-cover"
          />
        ))}
      </div>
      <form action="/api/shop" method="post" className="mt-3">
            <input type="hidden" name="_op" value="upload_photo" />
        <input type="hidden" name="job_id" value={job.id} />
        <label className="lbl">Upload / camera</label>
        <input className="field" type="file" name="file" accept="image/*" capture="environment" />
        <button className="tap mt-3" type="submit">
          Save photo
        </button>
      </form>

      {receipts.length > 0 ? (
        <div className="mt-8 panel">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-muted">
            Linked receipts
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {receipts.map((r) => (
              <li key={String(r.id)} className="flex justify-between">
                <span>{String(r.vendor)}</span>
                <span className="num">{money(Number(r.amount_cents))}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-muted">Created {formatDateTime(job.scheduled_at)}</p>
    </Shell>
  );
}
