"use client";

import { useEffect, useMemo, useState } from "react";
import { VehiclePicker } from "@/app/book/VehiclePicker";
import { ServiceChips } from "@/components/ServiceChips";
import { OPEN_JOB_STATUSES, STATUS_LABEL, type JobStatus } from "@/lib/status";
import { vehicleLabel } from "@/lib/format";

export type JobCustomer = { id: string; name: string; phone: string; email: string };
export type JobVehicle = {
  id: string;
  customer_id: string;
  year: number | null;
  make: string;
  model: string;
  engine: string;
};

export function NewJobForm({
  customers,
  vehicles = [],
}: {
  customers: JobCustomer[];
  vehicles?: JobVehicle[];
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [needService, setNeedService] = useState(false);

  const theirs = useMemo(
    () => vehicles.filter((v) => v.customer_id === customerId),
    [vehicles, customerId],
  );

  useEffect(() => {
    if (mode === "new") {
      setVehicleId("");
      return;
    }
    if (!customerId) {
      setVehicleId("");
      return;
    }
    if (theirs.length === 1) setVehicleId(theirs[0].id);
    else setVehicleId("");
  }, [customerId, mode, theirs]);

  const showYmme = mode === "new" || (Boolean(customerId) && (theirs.length === 0 || vehicleId === "__new__"));

  return (
    <form
      action="/api/shop"
      method="post"
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        if (!fd.getAll("service").length) {
          e.preventDefault();
          setNeedService(true);
        }
      }}
    >
      <input type="hidden" name="_op" value="create_job" />
      <input type="hidden" name="new_customer" value={mode === "new" ? "1" : "0"} />

      <div className="grid grid-cols-2 gap-2">
        <button
          className={`tap ${mode === "existing" ? "" : "tap-steel"}`}
          type="button"
          onClick={() => setMode("existing")}
        >
          Existing customer
        </button>
        <button
          className={`tap ${mode === "new" ? "" : "tap-steel"}`}
          type="button"
          onClick={() => setMode("new")}
        >
          New customer
        </button>
      </div>

      {mode === "new" ? (
        <>
          <label className="lbl">Name</label>
          <input className="field" name="name" required />
          <label className="lbl">Phone</label>
          <input className="field" name="phone" type="tel" required />
          <label className="lbl">Email</label>
          <input className="field" name="email" type="email" />
        </>
      ) : (
        <>
          <label className="lbl">Customer</label>
          <select
            className="field"
            name="customer_id"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Pick a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
          <label className="lbl">Vehicle</label>
          <select
            className="field"
            name="vehicle_id"
            required={!showYmme}
            disabled={!customerId}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">{customerId ? "Pick a vehicle" : "Pick a customer first"}</option>
            {theirs.map((v) => (
              <option key={v.id} value={v.id}>
                {vehicleLabel(v)}
                {v.engine ? ` ${v.engine}` : ""}
              </option>
            ))}
            {customerId ? <option value="__new__">Add vehicle</option> : null}
          </select>
        </>
      )}

      {showYmme ? <VehiclePicker withVin /> : null}

      <label className="lbl">Status</label>
      <select className="field" name="status" defaultValue="scheduled">
        {OPEN_JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s as JobStatus]}
          </option>
        ))}
      </select>
      <label className="lbl">When</label>
      <input className="field" type="datetime-local" name="scheduled_at" />
      <label className="lbl">Driveway address</label>
      <input className="field" name="address" />

      <p className="lbl">Services</p>
      <p className="mb-2 text-sm text-muted">Tap every job. You can pick more than one.</p>
      <ServiceChips onChange={() => setNeedService(false)} />
      <label className="lbl">Additional notes</label>
      <textarea className="field min-h-24" name="notes" placeholder="Anything else" />
      {needService ? <p className="mt-3 text-lg font-bold text-red">Pick at least one service.</p> : null}
      <button className="tap mt-6" type="submit">
        Create job
      </button>
    </form>
  );
}
