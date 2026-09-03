import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProfitPanel } from "@/components/ProfitPanel";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { getJobBundle, getSettings, getShopOilDefault, listCatalogItems, listDiscountPresets } from "@/lib/db/queries";
import { formatDateTime, money, vehicleLabel } from "@/lib/format";
import { OilSpecCard } from "@/components/OilSpecCard";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { laborLineCents, partCustomerCents } from "@/lib/profit";
import { JobDangerActions } from "../JobDangerActions";
import { AddItemCard } from "../AddItemCard";
import { isElectricEngine } from "@/lib/vpic";

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
  const { job, customer, vehicle, labor, parts, photos, invoice, receipts, profit, discounts } = bundle;
  const presets = await listDiscountPresets();
  const catalog = await listCatalogItems();
  const settings = await getSettings().catch(() => ({ oil_jug_qt: 5, oil_jug_cents: 0 }));
  const scheduled = job.scheduled_at
    ? new Date(job.scheduled_at).toISOString().slice(0, 16)
    : "";
  const saved = vehicle ? Number(vehicle.oil_saved) === 1 : false;
  const shop =
    vehicle?.id && !saved
      ? await getShopOilDefault({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          engine: vehicle.engine,
        }).catch(() => null)
      : null;

  return (
    <Shell title="Job">
      <div className="flex items-start justify-between gap-3">
        <div>
          {customer?.id ? (
            <Link href={`/customers/${customer.id}`} className="text-lg font-bold text-amber">
              {customer.name}
            </Link>
          ) : (
            <div className="text-lg font-bold">{customer?.name || "Deleted customer"}</div>
          )}
          <div className="text-muted">
            {vehicle?.id ? (
              <Link href={`/vehicles/${vehicle.id}`}>
                {vehicleLabel(vehicle)} {vehicle.plate ? `· ${vehicle.plate}` : ""}
              </Link>
            ) : (
              <span>
                {vehicleLabel(vehicle ?? {})} {vehicle?.plate ? `· ${vehicle.plate}` : ""}
              </span>
            )}
          </div>
        </div>
        <StatusBadge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</StatusBadge>
      </div>
      <JobDangerActions
        jobId={job.id}
        cancelled={job.status === "cancelled"}
        hasInvoice={Boolean(invoice)}
        hasReceipts={receipts.length > 0}
      />
      {vehicle?.id ? (
        <OilSpecCard
          compact
          vehicleId={vehicle.id}
          next={`/jobs/${job.id}`}
          savedQt={saved ? Number(vehicle.oil_qt) || null : null}
          savedViscosity={saved ? String(vehicle.oil_viscosity ?? "") : ""}
          savedTq={saved ? Number(vehicle.oil_drain_tq) || null : null}
          savedSocket={saved ? String(vehicle.oil_socket ?? "") : ""}
          shopQt={shop?.oil_qt ?? null}
          shopViscosity={shop?.oil_viscosity ?? ""}
          shopTq={shop?.oil_drain_tq ?? null}
          shopSocket={shop?.oil_socket ?? ""}
          engine={vehicle.engine}
        />
      ) : null}

      <form action="/api/shop" method="post" className="mt-4">
            <input type="hidden" name="_op" value="update_job" />
        <input type="hidden" name="id" value={job.id} />
        <label className="lbl">Status</label>
        <select className="field" name="status" defaultValue={job.status}>
          {JOB_STATUSES.filter((s) => s !== "cancelled" || job.status === "cancelled").map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
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
          Save
        </button>
      </form>

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

      <details className="mt-8" open={labor.length > 0}>
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          + Add labor
        </summary>
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
      </details>

      <details className="mt-8" open={parts.length > 0}>
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          + Add item
        </summary>
      <ul className="mt-3 space-y-2">
        {parts.map((p) => (
          <li key={p.id} className="panel">
            <form action="/api/shop" method="post" className="space-y-2">
              <input type="hidden" name="_op" value="update_part" />
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="job_id" value={job.id} />
              <label className="lbl">Name</label>
              <input className="field" name="description" defaultValue={p.description} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="lbl">Qty</label>
                  <input className="field" name="qty" inputMode="decimal" defaultValue={String(p.qty)} />
                </div>
                <div>
                  <label className="lbl">Cost $</label>
                  <input
                    className="field"
                    name="cost"
                    inputMode="decimal"
                    defaultValue={p.cost_cents ? (p.cost_cents / 100).toFixed(2) : ""}
                  />
                </div>
                <div>
                  <label className="lbl">Price $</label>
                  <input
                    className="field"
                    name="price"
                    inputMode="decimal"
                    defaultValue={p.price_cents ? (p.price_cents / 100).toFixed(2) : ""}
                    placeholder="cost"
                  />
                </div>
              </div>
              <div className="num text-xl text-amber">Extend {money(partCustomerCents(p))}</div>
              <button className="tap" type="submit">
                Save line
              </button>
            </form>
            <form action="/api/shop" method="post" className="mt-2">
              <input type="hidden" name="_op" value="delete_part" />
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="job_id" value={job.id} />
              <button className="text-xs font-bold uppercase tracking-widest text-red" type="submit">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
      <AddItemCard
        jobId={job.id}
        items={catalog}
        hideOil={!vehicle?.id || isElectricEngine(vehicle.engine)}
        quarts={
          saved
            ? Number(vehicle?.oil_qt) || null
            : shop?.oil_qt && Number(shop.oil_qt) > 0
              ? Number(shop.oil_qt)
              : null
        }
        viscosity={
          saved
            ? String(vehicle?.oil_viscosity ?? "")
            : String(shop?.oil_viscosity ?? "")
        }
        defaultJugQt={Number(settings.oil_jug_qt) || 5}
        defaultJugCents={Number(settings.oil_jug_cents) || 0}
      />
      </details>

      <details className="mt-8" open={(discounts?.length ?? 0) > 0}>
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          + Discounts
        </summary>
        <ul className="mt-3 space-y-2">
          {(discounts ?? []).map((d) => (
            <li key={d.id} className="panel flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">{d.name}</div>
                <div className="text-sm text-muted">
                  {d.kind === "amount" ? money(d.amount_cents) : `${d.pct}%`} off subtotal
                </div>
              </div>
              <form action="/api/shop" method="post">
                <input type="hidden" name="_op" value="delete_job_discount" />
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="job_id" value={job.id} />
                <button className="text-xs font-bold uppercase tracking-widest text-red" type="submit">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        {presets.length ? (
          <div className="mt-3 grid gap-2">
            {presets.map((p) => (
              <form key={p.id} action="/api/shop" method="post">
                <input type="hidden" name="_op" value="add_job_discount" />
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="preset_id" value={p.id} />
                <button className="tap tap-ghost" type="submit">
                  Add {p.name} {p.kind === "amount" ? money(p.amount_cents) : `${p.pct}%`}
                </button>
              </form>
            ))}
          </div>
        ) : null}
        <form action="/api/shop" method="post" className="mt-3 panel">
          <input type="hidden" name="_op" value="add_job_discount" />
          <input type="hidden" name="job_id" value={job.id} />
          <p className="text-sm text-muted">One-off — this job only, not saved to presets.</p>
          <label className="lbl">Name</label>
          <input className="field" name="name" placeholder="Neighbor" />
          <label className="lbl">Type</label>
          <select className="field" name="kind" defaultValue="percent">
            <option value="percent">Percent %</option>
            <option value="amount">Amount $</option>
          </select>
          <label className="lbl">Value</label>
          <input className="field" name="value" inputMode="decimal" placeholder="10 or 20" />
          <button className="tap mt-3" type="submit">
            Add this job only
          </button>
        </form>
      </details>

      <details className="mt-8" open={photos.length > 0}>
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
          + Add photos
        </summary>
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
      </details>

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
