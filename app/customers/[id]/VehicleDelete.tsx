"use client";

import { useState } from "react";
import { vehicleDeleteConfirm } from "@/lib/vehicle-delete";

export function VehicleDelete({
  vehicle,
}: {
  vehicle: { id: string; year?: number | null; make?: string | null; model?: string | null; vin?: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="mt-1 text-xs font-bold uppercase tracking-widest text-red" onClick={() => setOpen(true)}>
        Delete
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <div className="panel w-full max-w-lg bg-card p-4">
            <p className="text-lg font-bold">{vehicleDeleteConfirm(vehicle)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="tap tap-steel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <form action="/api/shop" method="post">
                <input type="hidden" name="_op" value="delete_vehicle" />
                <input type="hidden" name="id" value={vehicle.id} />
                <button className="tap tap-red" type="submit">
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
