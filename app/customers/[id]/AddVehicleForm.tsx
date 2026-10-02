"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Add Vehicle form: disables submit while the post is in flight so a double tap can't add the vehicle twice. */
export function AddVehicleForm({ error, children }: { error?: string; children: ReactNode }) {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // Re-enable if the page is restored from the back/forward cache.
    const reset = () => setSaving(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <form
      id="add-vehicle"
      action="/api/shop"
      method="post"
      className="mt-3 panel"
      onSubmit={(e) => {
        if (saving) {
          e.preventDefault();
          return;
        }
        setSaving(true);
      }}
    >
      {children}
      {error ? <p className="mt-3 text-sm font-bold text-red">{error}</p> : null}
      <button className="tap mt-4" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Add vehicle"}
      </button>
    </form>
  );
}
