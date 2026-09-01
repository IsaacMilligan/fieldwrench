"use client";

export function LeadHoursField({ value }: { value: number }) {
  return (
    <>
      <label className="lbl">Minimum lead time (hours)</label>
      <input
        className="field"
        id="lead_hours"
        name="lead_hours"
        type="number"
        min={0}
        max={168}
        defaultValue={String(value)}
      />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[0, 24, 48, 72].map((h) => (
          <button
            key={h}
            className="tap tap-steel"
            type="button"
            onClick={() => {
              const input = document.getElementById("lead_hours") as HTMLInputElement | null;
              if (input) input.value = String(h);
            }}
          >
            {h}h
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Customers can only pick a Preferred Date that is at least this far out. You confirm the actual time when you
        reply.
      </p>
    </>
  );
}
