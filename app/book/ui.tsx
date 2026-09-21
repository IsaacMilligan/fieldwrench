"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { ServiceChips } from "@/components/ServiceChips";
import { AddressField } from "@/components/AddressField";
import { VehiclePicker } from "./VehiclePicker";
import { ELECTRIC_ENGINE, isKnownBev } from "@/lib/vpic";
import { weekdayFromISO, WEEKDAY_NAMES, bookingDurationMinutes, formatClock, startTimesForDay, type DayHours } from "@/lib/schedule";
import type { ServiceChipItem } from "@/components/ServiceChips";

const DRAFT_KEY = "fw_book_draft";

type BookDraft = {
  name?: string;
  phone?: string;
  address?: string;
  address_lat?: string;
  address_lng?: string;
  notes?: string;
  preferred_date?: string;
  preferred_time?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_engine?: string;
  service?: string[];
};

function readDraft(): BookDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookDraft;
  } catch {
    return null;
  }
}

function stashForm(form: HTMLFormElement) {
  const fd = new FormData(form);
  const draft: BookDraft = {};
  const services: string[] = [];
  for (const [k, v] of fd.entries()) {
    if (k === "service") services.push(String(v));
    else (draft as Record<string, string>)[k] = String(v);
  }
  if (services.length) draft.service = services;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

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
  timeRejected,
  savedVehicles = [],
  minDate,
  leadHours,
  closedWeekdays,
  fullDates,
  radiusMi,
  hours,
  durations,
  slotStep,
  services,
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
  timeRejected?: boolean;
  savedVehicles?: { year: number | null; make: string; model: string }[];
  minDate: string;
  leadHours: number;
  closedWeekdays: number[];
  fullDates: string[];
  radiusMi: number;
  hours: DayHours[];
  durations: Record<string, number>;
  slotStep: number;
  services: ServiceChipItem[];
}) {
  const keepFields = Boolean(areaRejected || addressRejected);
  const [draftReady, setDraftReady] = useState(!keepFields);
  const [draft, setDraft] = useState<BookDraft | null>(null);

  useEffect(() => {
    if (!keepFields) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDraftReady(true);
      return;
    }
    const d = readDraft();
    setDraft(d);
    setDraftReady(true);
    requestAnimationFrame(() => {
      const el = document.getElementById("book-address");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    });
  }, [keepFields]);

  const draftServices = draft?.service ?? [];
  const [needService, setNeedService] = useState(false);
  const [picked, setPicked] = useState<string[]>(draftServices);
  const [startTime, setStartTime] = useState(draft?.preferred_time ?? "");
  const [needTime, setNeedTime] = useState(Boolean(timeRejected));
  const [bev, setBev] = useState(false);
  const [date, setDate] = useState(draft?.preferred_date && draft.preferred_date >= minDate ? draft.preferred_date : minDate);
  const [leadErr, setLeadErr] = useState(Boolean(leadRejected));
  const [closedErr, setClosedErr] = useState(Boolean(closedRejected));
  const [fullErr, setFullErr] = useState(Boolean(fullRejected));
  const leadMsg = `Pick a date at least ${leadHours} hours out.`;
  const closedNames = closedWeekdays.map((d) => WEEKDAY_NAMES[d]?.slice(0, 3)).filter(Boolean).join(", ");
  const durationMin = bookingDurationMinutes(picked, durations);
  const dateOk = Boolean(date) && date >= minDate && !closedWeekdays.includes(weekdayFromISO(date)) && !fullDates.includes(date);
  const slots = picked.length && dateOk ? startTimesForDay(hours, date, durationMin, slotStep) : [];
  const startValid = slots.includes(startTime);

  const vehicleInitial = useMemo(() => {
    if (!draft?.vehicle_year && !draft?.vehicle_make) return undefined;
    return {
      year: draft.vehicle_year ? Number(draft.vehicle_year) : null,
      make: draft.vehicle_make || "",
      model: draft.vehicle_model || "",
      engine: draft.vehicle_engine || "",
    };
  }, [draft]);

  useEffect(() => {
    setDate((d) => (!d || d < minDate ? minDate : d));
  }, [minDate]);

  useEffect(() => {
    if (draftServices.length) setPicked(draftServices);
    if (draft?.preferred_time) setStartTime(draft.preferred_time);
    if (draft?.preferred_date && draft.preferred_date >= minDate) setDate(draft.preferred_date);
  }, [draft, draftServices, minDate]);

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
    setStartTime("");
    setNeedTime(false);
  }

  if (ok) {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
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

  if (!draftReady) {
    return <div className="mx-auto min-h-dvh max-w-lg px-5 py-10" />;
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
        key={keepFields ? `restore-${draft?.address ?? "x"}` : "fresh"}
        action="/api/book"
        method="post"
        className="mt-6"
        onSubmit={(e) => {
          if (!services.length) {
            e.preventDefault();
            return;
          }
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
            return;
          }
          const t = String(fd.get("preferred_time") ?? "");
          if (!t || !slots.includes(t)) {
            e.preventDefault();
            setNeedTime(true);
            return;
          }
          stashForm(e.currentTarget);
        }}
      >
        <label className="lbl">Your name</label>
        <input className="field" name="name" required defaultValue={draft?.name ?? name ?? ""} />
        <label className="lbl">Phone</label>
        <input className="field" name="phone" type="tel" required defaultValue={draft?.phone ?? phone ?? ""} />
        <label className="lbl" htmlFor="book-address">
          Address
        </label>
        <AddressField
          required
          placeholder="Street, city, ZIP"
          defaultValue={draft?.address ?? ""}
          defaultLat={draft?.address_lat ?? ""}
          defaultLng={draft?.address_lng ?? ""}
          invalid={areaRejected || addressRejected}
        />
        <p className="mt-2 text-xs text-muted">Must be inside the {radiusMi}-mile service area.</p>
        {areaRejected ? (
          <p id="book-address-err" className="mt-2 text-lg font-bold text-red">
            Outside the {radiusMi}-mile service area. Try a driveway closer to Eagle Mountain, or text (801) 692-3778.
          </p>
        ) : null}
        {addressRejected ? (
          <p id="book-address-err" className="mt-2 text-lg font-bold text-red">
            Couldn’t find that address. Add a city and ZIP.
          </p>
        ) : null}
        <VehiclePicker
          saved={savedVehicles}
          initial={vehicleInitial}
          onYmme={(v) => setBev(isKnownBev(v.make, v.model) || v.engine === ELECTRIC_ENGINE)}
        />
        <p className="lbl">Services</p>
        {services.length === 0 ? (
          <p className="mt-2 text-lg font-bold text-red">Booking unavailable — check back soon</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">Tap every job you want. You can pick more than one.</p>
            <ServiceChips
              items={services}
              bev={bev}
              variant="rows"
              initialSelected={draftServices}
              onChange={(ids) => {
                setPicked(ids);
                setNeedService(false);
                setStartTime("");
                setNeedTime(false);
              }}
            />
            {picked.length ? (
              <p className="mt-2 text-sm text-muted">About {durationMin} min on-site</p>
            ) : null}
          </>
        )}
        <label className="lbl">Additional notes</label>
        <textarea
          className="field min-h-24"
          name="notes"
          defaultValue={draft?.notes ?? ""}
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
        <p className="lbl mt-4">Start time</p>
        <input type="hidden" name="preferred_time" value={startValid ? startTime : ""} />
        {!picked.length ? (
          <p className="mt-2 text-sm text-muted">Pick services first</p>
        ) : !dateOk ? (
          <p className="mt-2 text-sm text-muted">Pick an open date first.</p>
        ) : slots.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {slots.map((t) => {
              const on = startTime === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={`flex min-h-14 items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-sm font-extrabold ${
                    on ? "border-amber bg-amber text-[#120e04]" : "border-line bg-panel2"
                  }`}
                  onClick={() => {
                    setStartTime(t);
                    setNeedTime(false);
                  }}
                >
                  {formatClock(t)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold text-red">Nothing that long fits that day.</p>
        )}
        <p id="preferred-date-help" className="mt-2 text-sm text-muted">
          This is a request — I’ll confirm when I reply.
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
        {needService ? <p className="mt-3 text-lg font-bold text-red">Pick at least one service.</p> : null}
        {needTime ? <p className="mt-3 text-lg font-bold text-red">Pick a start time that fits.</p> : null}
        {failed ? <p className="mt-3 text-red">Could not save the request. Try again.</p> : null}
        <button className="tap mt-6" type="submit" disabled={services.length === 0}>
          Send request
        </button>
      </form>
    </div>
  );
}
