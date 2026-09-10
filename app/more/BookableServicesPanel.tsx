import { formatDurationLabel, type BookableService } from "@/lib/bookable-services";

export function BookableServicesPanel({
  services,
  error,
}: {
  services: BookableService[];
  error?: string;
}) {
  return (
    <section id="bookable" className="panel mt-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest">
        Bookable services
      </h2>
      <p className="mt-2 text-sm text-muted">
        Shown on /book. Duration drives start times. Hide keeps old booking labels.
      </p>
      {error ? <p className="mt-3 text-sm font-bold text-red">{error}</p> : null}
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {services.map((svc) => (
          <li key={svc.id} className="flex items-start gap-1 py-1">
            <details className="group min-w-0 flex-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
                <span className="inline-block w-4 shrink-0 text-sm transition-transform group-open:rotate-90" aria-hidden>
                  ▶
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {svc.name} · {formatDurationLabel(svc.duration_min)}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
                    svc.active ? "bg-amber/20 text-amber" : "bg-panel2 text-muted"
                  }`}
                >
                  {svc.active ? "On" : "Hidden"}
                </span>
              </summary>
              <form action="/api/shop" method="post" className="space-y-2 pb-3 pl-6">
                <input type="hidden" name="_op" value="update_bookable_service" />
                <input type="hidden" name="id" value={svc.id} />
                <label className="lbl">Name</label>
                <input className="field" name="name" defaultValue={svc.name} required />
                <label className="lbl">Duration (minutes)</label>
                <input className="field" name="duration_min" inputMode="numeric" defaultValue={String(svc.duration_min)} />
                <label className="lbl">Public blurb (optional)</label>
                <input className="field" name="blurb" defaultValue={svc.blurb} placeholder="Pads and rotors" />
                <button className="tap" type="submit">
                  Save
                </button>
              </form>
              <div className="grid grid-cols-2 gap-2 pb-3 pl-6">
                <form action="/api/shop" method="post">
                  <input type="hidden" name="_op" value="set_bookable_service_active" />
                  <input type="hidden" name="id" value={svc.id} />
                  <input type="hidden" name="active" value={svc.active ? "0" : "1"} />
                  <button className="tap tap-steel" type="submit">
                    {svc.active ? "Hide on /book" : "Show on /book"}
                  </button>
                </form>
                <form action="/api/shop" method="post">
                  <input type="hidden" name="_op" value="delete_bookable_service" />
                  <input type="hidden" name="id" value={svc.id} />
                  <button className="tap tap-red" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            </details>
            <div className="flex shrink-0 flex-col">
              <form action="/api/shop" method="post">
                <input type="hidden" name="_op" value="reorder_bookable_service" />
                <input type="hidden" name="id" value={svc.id} />
                <input type="hidden" name="dir" value="up" />
                <button className="flex h-11 w-11 items-center justify-center font-bold" type="submit" aria-label="Move up">
                  ↑
                </button>
              </form>
              <form action="/api/shop" method="post">
                <input type="hidden" name="_op" value="reorder_bookable_service" />
                <input type="hidden" name="id" value={svc.id} />
                <input type="hidden" name="dir" value="down" />
                <button className="flex h-11 w-11 items-center justify-center font-bold" type="submit" aria-label="Move down">
                  ↓
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <details className="group mt-3 border-t border-line pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          <span className="inline-block w-4 shrink-0 text-sm transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          Add service
        </summary>
        <form action="/api/shop" method="post" className="space-y-2 pb-2 pl-6">
          <input type="hidden" name="_op" value="add_bookable_service" />
          <label className="lbl">Name</label>
          <input className="field" name="name" placeholder="Mobile detail" required />
          <label className="lbl">Duration (minutes)</label>
          <input className="field" name="duration_min" inputMode="numeric" defaultValue="90" />
          <label className="lbl">Public blurb (optional)</label>
          <input className="field" name="blurb" />
          <button className="tap mt-2" type="submit">
            Add service
          </button>
        </form>
      </details>
    </section>
  );
}
