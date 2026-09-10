import { squareConfigured, squareEnv } from "@/lib/square";

export function SquareSettingsPanel({ note }: { note: string }) {
  const env = squareEnv();
  const ok = squareConfigured();
  return (
    <section id="square" className="panel mt-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Square
      </h2>
      <p className="mt-2 text-sm text-muted">
        Collect payment with Square’s hosted invoice. FieldWrench totals stay the source of truth.
      </p>
      <p className={`mt-3 text-sm font-bold ${ok ? "text-green" : "text-red"}`}>
        {ok
          ? `Connected · ${env?.environment === "production" ? "production" : "sandbox"}`
          : "Missing env — not connected"}
      </p>
      {!ok ? (
        <p className="mt-2 text-xs text-muted">
          In Vercel (Production + Preview) set server-only: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID,
          SQUARE_ENVIRONMENT=sandbox or production. Then redeploy. Never NEXT_PUBLIC_*.
        </p>
      ) : null}
      <label className="lbl mt-3" htmlFor="square_note">
        Default invoice note
      </label>
      <input
        id="square_note"
        form="fw-settings"
        className="field"
        name="square_note"
        defaultValue={note}
      />
      <p className="mt-2 text-xs text-muted">Saved with Save settings above. Default: Ascent Auto Care — driveway service.</p>
    </section>
  );
}
