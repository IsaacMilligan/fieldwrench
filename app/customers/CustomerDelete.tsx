"use client";

import { useState } from "react";
import { vehicleNoun } from "@/lib/format";

export function CustomerDelete({
  customerId,
  name,
  vehicleCount,
  jobCount,
  unpaidInvoices,
}: {
  customerId: string;
  name: string;
  vehicleCount: number;
  jobCount: number;
  unpaidInvoices: number;
}) {
  const [open, setOpen] = useState(false);
  const bits = [
    vehicleCount > 0 ? vehicleNoun(vehicleCount) : null,
    jobCount > 0 ? (jobCount === 1 ? "1 job" : `${jobCount} jobs`) : null,
    unpaidInvoices > 0
      ? unpaidInvoices === 1
        ? "1 unpaid invoice"
        : `${unpaidInvoices} unpaid invoices`
      : null,
  ].filter(Boolean);

  return (
    <div className="mt-10">
      <button type="button" className="tap tap-red" onClick={() => setOpen(true)}>
        Delete customer
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <div className="panel w-full max-w-lg bg-card p-4">
            <p className="text-lg font-bold">
              Delete {name}? This can’t be undone.
            </p>
            {bits.length ? <p className="mt-2 text-sm text-muted">{bits.join(" · ")}</p> : null}
            {unpaidInvoices > 0 ? (
              <p className="mt-2 text-sm font-bold text-red">This customer has unpaid invoices.</p>
            ) : null}
            <p className="mt-2 text-sm text-muted">Jobs and invoices stay. Vehicles are removed.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="tap tap-steel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <form action="/api/shop" method="post">
                <input type="hidden" name="_op" value="delete_customer" />
                <input type="hidden" name="id" value={customerId} />
                <button className="tap tap-red" type="submit">
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
