import type { BookableService } from "@/lib/bookable-services";

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
        These chips show on /book. Duration drives which start times fit before close. Hide keeps old bookings’ labels.
      </p>
      {error ? <p className="mt-3 text-sm font-bold text-red">{error}</p> : null}
      <ul className="mt-3 space-y-4">
        {services.map((svc) => (
          <li key={svc.id} className="border-t border-line pt-3">
            <div className="flex items-start gap-2">
              <form action="/api/shop" method="post" className="min-w-0 flex-1 space-y-2">
                <input type="hidden" name="_op" value="update_bookable_service" />
                <input type="hidden" name="id" value={svc.id} />
                <label className="lbl">Name</label>
                <input className="field" name="name" defaultValue={svc.name} required />
                <label className="lbl">Duration (minutes)</label>
                <input className="field" name="duration_min" inputMode="numeric" defaultValue={String(svc.duration_min)} />
                <label className="lbl">Public blurb (optional)</label>
                <input className="field" name="blurb" defaultValue={svc.blurb} placeholder="Pads and rotors" />
                {!svc.active ? <p className="text-xs font-bold text-muted">Hidden on /book</p> : null}
                <button className="tap" type="submit">
                  Save
                </button>
              </form>
              <div className="flex flex-col gap-1">
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
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
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
          </li>
        ))}
      </ul>
      <form action="/api/shop" method="post" className="mt-4">
        <input type="hidden" name="_op" value="add_bookable_service" />
        <p className="lbl">Add service</p>
        <label className="lbl">Name</label>
        <input className="field" name="name" placeholder="Mobile detail" required />
        <label className="lbl">Duration (minutes)</label>
        <input className="field" name="duration_min" inputMode="numeric" defaultValue="90" />
        <label className="lbl">Public blurb (optional)</label>
        <input className="field" name="blurb" />
        <button className="tap mt-3" type="submit">
          Add service
        </button>
      </form>
    </section>
  );
}
