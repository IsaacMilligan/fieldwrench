"use client";

export function JobDangerActions({
  jobId,
  cancelled,
  hasInvoice,
  hasReceipts,
}: {
  jobId: string;
  cancelled: boolean;
  hasInvoice: boolean;
  hasReceipts: boolean;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {cancelled ? (
        <div className="flex min-h-14 items-center justify-center rounded border-2 border-line px-3 text-center text-sm font-extrabold uppercase tracking-widest text-muted">
          Cancelled
        </div>
      ) : (
        <form action="/api/shop" method="post">
          <input type="hidden" name="_op" value="set_status" />
          <input type="hidden" name="id" value={jobId} />
          <input type="hidden" name="status" value="cancelled" />
          <button className="tap tap-steel" type="submit">
            Cancel job
          </button>
        </form>
      )}
      <form
        action="/api/shop"
        method="post"
        onSubmit={(e) => {
          const extra = hasInvoice || hasReceipts ? " This job has an invoice / receipts." : "";
          if (!confirm(`Delete this job? This can’t be undone.${extra}`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="_op" value="delete_job" />
        <input type="hidden" name="id" value={jobId} />
        <button className="tap tap-red" type="submit">
          Delete job
        </button>
      </form>
    </div>
  );
}
