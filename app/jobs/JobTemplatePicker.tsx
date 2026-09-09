"use client";

import { useState } from "react";
import type { JobTemplate } from "@/lib/job-templates";

export function JobTemplatePicker({
  templates,
  jobId,
  hideOil,
  hasLines,
}: {
  templates: JobTemplate[];
  jobId?: string;
  hideOil?: boolean;
  hasLines?: boolean;
}) {
  const [picked, setPicked] = useState<JobTemplate | null>(null);
  const [confirm, setConfirm] = useState<JobTemplate | null>(null);
  const visible = hideOil ? templates.filter((t) => t.service_type !== "oil_change") : templates;
  if (!visible.length) return null;

  function tap(t: JobTemplate) {
    if (!jobId) {
      setPicked(t);
      return;
    }
    if (hasLines) {
      setConfirm(t);
      return;
    }
    setConfirm(t);
  }

  return (
    <div className="mt-4">
      {!jobId ? <input type="hidden" name="template_id" value={picked?.id ?? ""} /> : null}
      <p className="lbl">Job template</p>
      <div className="grid grid-cols-2 gap-2">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tap ${picked?.id === t.id && !jobId ? "" : "tap-steel"}`}
            onClick={() => tap(t)}
          >
            {t.name}
            <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">{t.price_range_label}</span>
          </button>
        ))}
      </div>
      {picked && !jobId ? (
        <p className="mt-2 text-sm text-muted">
          {picked.price_range_label}
          {picked.notes ? ` — ${picked.notes}` : ""}
        </p>
      ) : null}
      {confirm && jobId ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
          <div className="panel w-full max-w-lg">
            <p className="text-lg font-bold">Apply {confirm.name}?</p>
            <p className="mt-1 text-sm text-muted">{confirm.price_range_label}. Anchors only — you can edit lines after.</p>
            {hasLines ? <p className="mt-2 text-sm">This job already has labor or parts.</p> : null}
            <form action="/api/shop" method="post" className="mt-3">
              <input type="hidden" name="_op" value="apply_job_template" />
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="template_id" value={confirm.id} />
              <input type="hidden" name="mode" value="replace" />
              <button className="tap" type="submit">
                Replace
              </button>
            </form>
            {hasLines ? (
              <form action="/api/shop" method="post" className="mt-2">
                <input type="hidden" name="_op" value="apply_job_template" />
                <input type="hidden" name="job_id" value={jobId} />
                <input type="hidden" name="template_id" value={confirm.id} />
                <input type="hidden" name="mode" value="merge" />
                <button className="tap tap-steel" type="submit">
                  Merge
                </button>
              </form>
            ) : null}
            <button className="tap tap-steel mt-2" type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
