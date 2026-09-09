import Link from "next/link";
import { money } from "@/lib/format";
import type { JobTemplate } from "@/lib/job-templates";

export function JobTemplateList({ templates }: { templates: JobTemplate[] }) {
  return (
    <ul>
      {templates.map((t) => (
        <li key={t.id} className="border-b border-line">
          <div className="flex min-h-[52px] items-center gap-2 px-1">
            <Link href={`/more/templates/${t.id}`} className="min-w-0 flex-1 py-2">
              <div className="truncate font-bold">
                {t.name}
                {!t.active ? <span className="ml-2 text-xs text-muted">archived</span> : null}
              </div>
              <div className="text-xs text-muted">
                {money(t.default_labor_cents)} labor · {t.price_range_label}
              </div>
            </Link>
            <form action="/api/shop" method="post">
              <input type="hidden" name="_op" value="reorder_job_template" />
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="dir" value="up" />
              <button className="flex h-11 w-11 items-center justify-center font-bold" type="submit" aria-label="Move up">
                ↑
              </button>
            </form>
            <form action="/api/shop" method="post">
              <input type="hidden" name="_op" value="reorder_job_template" />
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="dir" value="down" />
              <button className="flex h-11 w-11 items-center justify-center font-bold" type="submit" aria-label="Move down">
                ↓
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
