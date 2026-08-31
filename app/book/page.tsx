"use client";

import { useActionState } from "react";
import { publicBookAction } from "@/lib/actions";
import { Mark } from "@/components/Mark";

export default function BookPage() {
  const [state, action] = useActionState(publicBookAction, null);
  if (state?.ok) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
        <Mark big />
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase">
          Request in
        </h1>
        <p className="mt-3 text-lg text-muted">
          The shop will text or call to confirm a driveway window. This is a request, not a locked slot.
        </p>
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
      <form action={action} className="mt-6">
        <label className="lbl">Your name</label>
        <input className="field" name="name" required />
        <label className="lbl">Phone</label>
        <input className="field" name="phone" type="tel" required />
        <label className="lbl">Address</label>
        <input className="field" name="address" required />
        <label className="lbl">Vehicle</label>
        <input className="field" name="vehicle" placeholder="2018 Chevy Equinox" required />
        <label className="lbl">What&apos;s going on</label>
        <textarea className="field min-h-28" name="issue" required />
        <label className="lbl">Preferred time</label>
        <input className="field" name="preferred_time" placeholder="Saturday morning" />
        {state?.error ? <p className="mt-3 text-red">{state.error}</p> : null}
        <button className="tap mt-6" type="submit">
          Send request
        </button>
      </form>
    </div>
  );
}
