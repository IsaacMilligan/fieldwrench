import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getJobTemplate } from "@/lib/db/queries";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JobTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const t = await getJobTemplate(id);
  if (!t) notFound();
  return (
    <Shell title="Job template">
      <Link href="/more?tab=settings" className="text-sm font-bold text-amber">
        ← Job templates
      </Link>
      <form action="/api/shop" method="post" className="mt-4">
        <input type="hidden" name="_op" value="update_job_template" />
        <input type="hidden" name="id" value={t.id} />
        <label className="lbl">Name</label>
        <input className="field" name="name" defaultValue={t.name} />
        <label className="lbl">Labor anchor $</label>
        <input
          className="field"
          name="labor"
          inputMode="decimal"
          defaultValue={(t.default_labor_cents / 100).toFixed(2)}
        />
        <label className="lbl">Published range</label>
        <input className="field" name="price_range_label" defaultValue={t.price_range_label} />
        <label className="lbl">Notes</label>
        <textarea className="field min-h-24" name="notes" defaultValue={t.notes} />
        <label className="mt-3 flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" name="active" value="1" defaultChecked={t.active} className="h-6 w-6" />
          Active
        </label>
        <button className="tap mt-4" type="submit">
          Save template
        </button>
      </form>
      <h2 className="mt-8 font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-widest">
        Checklist
      </h2>
      <ul className="mt-3 space-y-2">
        {t.lines.map((ln) => (
          <li key={ln.id} className="panel">
            <div className="font-bold">{ln.label}</div>
            <div className="text-sm text-muted">
              {ln.kind}
              {ln.optional ? " · optional" : ""}
              {ln.catalog_match ? ` · ${ln.catalog_match}` : ""}
            </div>
            <form action="/api/shop" method="post" className="mt-2">
              <input type="hidden" name="_op" value="delete_job_template_line" />
              <input type="hidden" name="id" value={ln.id} />
              <input type="hidden" name="template_id" value={t.id} />
              <button className="text-xs font-bold uppercase tracking-widest text-red" type="submit">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action="/api/shop" method="post" className="mt-4 panel">
        <input type="hidden" name="_op" value="add_job_template_line" />
        <input type="hidden" name="template_id" value={t.id} />
        <label className="lbl">New line</label>
        <input className="field" name="label" required placeholder="Cabin filter" />
        <label className="lbl">Kind</label>
        <select className="field" name="kind" defaultValue="part">
          <option value="part">Part</option>
          <option value="oil">Oil (jug math)</option>
          <option value="checklist">Checklist</option>
        </select>
        <label className="lbl">Catalog name match</label>
        <input className="field" name="catalog_match" placeholder="Filter" />
        <label className="mt-3 flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" name="optional" value="1" className="h-6 w-6" />
          Optional
        </label>
        <button className="tap mt-3" type="submit">
          Add line
        </button>
      </form>
      <form action="/api/shop" method="post" className="mt-6">
        <input type="hidden" name="_op" value="archive_job_template" />
        <input type="hidden" name="id" value={t.id} />
        <button className="tap tap-red" type="submit">
          Archive
        </button>
      </form>
      <p className="mt-4 text-xs text-muted">Labor anchor {money(t.default_labor_cents)}. Prices on a job stay editable.</p>
    </Shell>
  );
}
