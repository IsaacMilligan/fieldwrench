import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProfitPanel } from "@/components/ProfitPanel";
import { StatusBadge } from "@/components/Mark";
import { requireSession } from "@/lib/auth";
import { getJobBundle, getSettings, getShopOilDefault, listCatalogItems, listDiscountPresets, listJobTemplates } from "@/lib/db/queries";
import { formatDateTime, money, vehicleLabel } from "@/lib/format";
import { OilSpecCard } from "@/components/OilSpecCard";
import { JOB_STATUSES, STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { laborLineCents, partCustomerCents } from "@/lib/profit";
import { JobDangerActions } from "../JobDangerActions";
import { AddItemCard } from "../AddItemCard";
import { JobTemplatePicker } from "../JobTemplatePicker";
import { KeepJobScroll } from "../KeepJobScroll";
import { PhotoUploadForm } from "../PhotoUploadForm";
import { AddressField } from "@/components/AddressField";
import { isElectricEngine } from "@/lib/vpic";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ oil?: string; e?: string; photo?: string; msg?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const q = await searchParams;
  const bundle = await getJobBundle(id);
  if (!bundle) notFound();
  const { job, customer, vehicle, labor, parts, photos, invoice, receipts, profit, discounts } = bundle;
  const presets = await listDiscountPresets();
  const catalog = await listCatalogItems();
  const templates = await listJobTemplates();
  const settings = await getSettings().catch(() => ({ labor_rate_cents: 0 }));
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

  const laborTotal = labor.reduce(
    (s, l) =>
      s +
      laborLineCents({
        isFlat: l.is_flat,
        flatCents: l.flat_cents,
        hours: l.hours,
        rateCents: l.rate_cents,
      }),
    0,
  );
  const itemsTotal = parts.reduce((s, p) => s + partCustomerCents(p), 0);
  const discountTotal = Math.round(Number(profit.discountTotal) || 0);

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
      {q.oil === "need" ? (
        <p className="mt-3 text-sm font-bold text-amber">Set oil specs on the vehicle to bill quarts from the jug.</p>
      ) : null}
      {q.e === "bev" ? (
        <p className="mt-3 text-sm font-bold text-amber">Oil change is N/A on a BEV.</p>
      ) : null}
      {q.e === "rate" ? (
        <p className="mt-3 text-sm font-bold text-amber">
          Set labor rate $/hr in Settings first.{" "}
          <Link href="/more?tab=settings" className="underline">
            Settings
          </Link>
        </p>
      ) : null}
      <JobDangerActions
        jobId={job.id}
        cancelled={job.status === "cancelled"}
        hasInvoice={Boolean(invoice)}
        hasReceipts={receipts.length > 0}
      />
      <JobTemplatePicker
        templates={templates}
        jobId={job.id}
        hideOil={!vehicle?.id || isElectricEngine(vehicle.engine)}
        hasLines={labor.length + parts.length > 0}
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
        <AddressField defaultValue={job.address} />
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

      <KeepJobScroll>
      <details id="labor" className="group mt-8" open={labor.length > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest [&::-webkit-details-marker]:hidden">
          <span className="inline-block shrink-0 text-base transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          <span className="min-w-0 flex-1">+ Add labor</span>
          <span className="num shrink-0 text-xl font-extrabold normal-case tracking-normal">{money(laborTotal)}</span>
        </summary>
      <ul className="mt-3 space-y-2">
        {labor.map((l) => (
          <li key={l.id} className="panel">
            <form action="/api/shop" method="post" className="space-y-2">
              <input type="hidden" name="_op" value="update_labor" />
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="mode" value={l.is_flat ? "flat" : "hours"} />
              <input className="field" name="description" defaultValue={l.description} />
              {l.is_flat ? (
                <>
                  <label className="lbl">Amount $</label>
                  <input
                    className="field"
                    name="flat"
                    inputMode="decimal"
                    defaultValue={l.flat_cents ? (l.flat_cents / 100).toFixed(2) : ""}
                  />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="lbl">Hours</label>
                    <input className="field" name="hours" inputMode="decimal" defaultValue={String(l.hours)} />
                  </div>
                  <div>
                    <label className="lbl">Rate $</label>
                    <input
                      className="field"
                      name="rate"
                      inputMode="decimal"
                      defaultValue={l.rate_cents ? (l.rate_cents / 100).toFixed(2) : ""}
                    />
                  </div>
                </div>
              )}
              <div className="num text-xl text-amber">
                {money(laborLineCents({
                  isFlat: l.is_flat,
                  flatCents: l.flat_cents,
                  hours: l.hours,
                  rateCents: l.rate_cents,
                }))}
              </div>
              <button className="tap" type="submit">
                Save labor
              </button>
            </form>
            <form action="/api/shop" method="post" className="mt-2">
              <input type="hidden" name="_op" value="delete_labor" />
              <input type="hidden" name="id" value={l.id} />
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
        hideOil
        quarts={null}
        viscosity=""
        laborRateCents={Number(settings.labor_rate_cents) || 0}
        section="labor"
      />
      </details>

      <details id="parts" className="group mt-8" open={parts.length > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest [&::-webkit-details-marker]:hidden">
          <span className="inline-block shrink-0 text-base transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          <span className="min-w-0 flex-1">+ Add item</span>
          <span className="num shrink-0 text-xl font-extrabold normal-case tracking-normal">{money(itemsTotal)}</span>
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
        laborRateCents={Number(settings.labor_rate_cents) || 0}
        section="items"
      />
      </details>

      <details id="discounts" className="group mt-8" open={(discounts?.length ?? 0) > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest [&::-webkit-details-marker]:hidden">
          <span className="inline-block shrink-0 text-base transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          <span className="min-w-0 flex-1">+ Discounts</span>
          <span className="num shrink-0 text-xl font-extrabold normal-case tracking-normal">
            {discountTotal > 0 ? `−${money(discountTotal)}` : money(0)}
          </span>
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
      <details id="photos" className="group mt-8" open={photos.length > 0 || q.photo === "1" || q.e === "photo"}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest [&::-webkit-details-marker]:hidden">
          <span className="inline-block shrink-0 text-base transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          <span className="min-w-0 flex-1">+ Add photos</span>
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
      {q.e === "photo" ? (
        <p className="mt-3 text-sm font-bold text-red">{q.msg || "Could not save photo."}</p>
      ) : null}
      <PhotoUploadForm jobId={job.id} focus={q.photo === "1" || q.e === "photo"} />
      </details>
      </KeepJobScroll>

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
