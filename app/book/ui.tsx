"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { ServiceChips } from "@/components/ServiceChips";
import { VehiclePicker } from "./VehiclePicker";
import { ELECTRIC_ENGINE, isKnownBev } from "@/lib/vpic";
import { weekdayFromISO, WEEKDAY_NAMES } from "@/lib/schedule";

export function BookForm({
  signedIn,
  name,
  phone,
  ok,
  failed,
  leadRejected,
  closedRejected,
  fullRejected,
  areaRejected,
  addressRejected,
  savedVehicles = [],
  minDate,
  leadHours,
  closedWeekdays,
  fullDates,
  radiusMi,
}: {
  signedIn: boolean;
  name?: string;
  phone?: string;
  ok?: boolean;
  failed?: boolean;
  leadRejected?: boolean;
  closedRejected?: boolean;
  fullRejected?: boolean;
  areaRejected?: boolean;
  addressRejected?: boolean;
  savedVehicles?: { year: number | null; make: string; model: string }[];
  minDate: string;
  leadHours: number;
  closedWeekdays: number[];
  fullDates: string[];
  radiusMi: number;
}) {
  const [needService, setNeedService] = useState(false);
  const [bev, setBev] = useState(false);
  const [date, setDate] = useState(minDate);
  const [leadErr, setLeadErr] = useState(Boolean(leadRejected));
  const [closedErr, setClosedErr] = useState(Boolean(closedRejected));
  const [fullErr, setFullErr] = useState(Boolean(fullRejected));
  const leadMsg = `Pick a date at least ${leadHours} hours out.`;
  const closedNames = closedWeekdays.map((d) => WEEKDAY_NAMES[d]?.slice(0, 3)).filter(Boolean).join(", ");

  useEffect(() => {
    setDate((d) => (!d || d < minDate ? minDate : d));
  }, [minDate]);

  function applyDate(raw: string) {
    if (!raw) {
      setDate("");
      return;
    }
    if (raw < minDate) {
      setDate(minDate);
      setLeadErr(true);
      setClosedErr(false);
      setFullErr(false);
      return;
    }
    setDate(raw);
    setLeadErr(false);
    setClosedErr(closedWeekdays.includes(weekdayFromISO(raw)));
    setFullErr(fullDates.includes(raw));
  }

  if (ok) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
        <Mark big />
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase">
          Request in
        </h1>
        <p className="mt-3 text-lg text-muted">
          The shop will text or call to confirm a driveway window. This is a request, not a locked slot.
        </p>
        {signedIn ? (
          <Link href="/customer" className="tap mt-6 flex items-center justify-center">
            Your requests
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Mark />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        Book a driveway visit
      </h1>
      <p className="mt-2 text-muted">FieldWrench comes to you. No shop drop-off.</p>
      <p className="mt-3 text-sm">
        {signedIn ? (
          <Link className="text-amber" href="/customer">
            Signed in — view your requests
          </Link>
        ) : (
          <>
            <Link className="text-amber" href="/customer/login">
              Customer login
            </Link>
            {" · "}
            <Link className="text-amber" href="/customer/signup">
              Create login
            </Link>
          </>
        )}
      </p>
      <form
        action="/api/book"
        method="post"
        className="mt-6"
        onSubmit={(e) => {
          const fd = new FormData(e.currentTarget);
          if (!fd.getAll("service").length) {
            e.preventDefault();
            setNeedService(true);
            return;
          }
          const day = String(fd.get("preferred_date") ?? "");
          if (!day || day < minDate) {
            e.preventDefault();
            setDate(minDate);
            setLeadErr(true);
            return;
          }
          if (closedWeekdays.includes(weekdayFromISO(day))) {
            e.preventDefault();
            setClosedErr(true);
            return;
          }
          if (fullDates.includes(day)) {
            e.preventDefault();
            setFullErr(true);
          }
        }}
      >
        <label className="lbl">Your name</label>
        <input className="field" name="name" required defaultValue={name ?? ""} />
        <label className="lbl">Phone</label>
        <input className="field" name="phone" type="tel" required defaultValue={phone ?? ""} />
        <label className="lbl">Address</label>
        <input className="field" name="address" required placeholder="Street, city, ZIP" />
        <p className="mt-2 text-xs text-muted">Must be inside the {radiusMi}-mile service area.</p>
        <VehiclePicker
          saved={savedVehicles}
          onYmme={(v) => setBev(isKnownBev(v.make, v.model) || v.engine === ELECTRIC_ENGINE)}
        />
        <p className="lbl">Services</p>
        <p className="mb-2 text-sm text-muted">Tap every job you want. You can pick more than one.</p>
        <ServiceChips bev={bev} onChange={() => setNeedService(false)} />
        <label className="lbl">Additional notes</label>
        <textarea
          className="field min-h-24"
          name="notes"
          placeholder="Anything else — driveway, gate code, noise details…"
        />
        <label className="lbl" htmlFor="preferred_date">
          Preferred Date
        </label>
        <input
          id="preferred_date"
          className="field"
          type="date"
          name="preferred_date"
          required
          min={minDate}
          value={date}
          aria-invalid={leadErr || closedErr || fullErr}
          aria-describedby="preferred-date-help preferred-date-err"
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length === 1) e.preventDefault();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            e.preventDefault();
            if (/^\d{4}-\d{2}-\d{2}$/.test(text)) applyDate(text);
          }}
          onInput={(e) => applyDate(e.currentTarget.value)}
          onChange={(e) => applyDate(e.target.value)}
          onBlur={(e) => applyDate(e.target.value || minDate)}
        />
        <label className="lbl">Preferred window</label>
        <select className="field" name="preferred_window" defaultValue="either">
          <option value="either">Either</option>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
        </select>
        <p id="preferred-date-help" className="mt-2 text-sm text-muted">
          I’ll confirm the exact time when I reply.
          {closedNames ? ` Closed: ${closedNames}.` : ""}
        </p>
        {leadErr ? (
          <p id="preferred-date-err" className="mt-3 text-lg font-bold text-red">
            {leadMsg}
          </p>
        ) : closedErr ? (
          <p id="preferred-date-err" className="mt-3 text-lg font-bold text-red">
            Shop is closed that day.
          </p>
        ) : fullErr ? (
          <p id="preferred-date-err" className="mt-3 text-lg font-bold text-red">
            That day is already full.
          </p>
        ) : (
          <span id="preferred-date-err" className="hidden" />
        )}
        {areaRejected ? (
          <p className="mt-3 text-lg font-bold text-red">Outside the {radiusMi}-mile service area.</p>
        ) : null}
        {addressRejected ? (
          <p className="mt-3 text-lg font-bold text-red">Couldn’t find that address. Add a city and ZIP.</p>
        ) : null}
        {needService ? <p className="mt-3 text-lg font-bold text-red">Pick at least one service.</p> : null}
        {failed ? <p className="mt-3 text-red">Could not save the request. Try again.</p> : null}
        <button className="tap mt-6" type="submit">
          Send request
        </button>
      </form>
    </div>
  );
}
