import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/db/queries";
import { resetDemoAction, saveSettingsAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession();
  const s = await getSettings();
  return (
    <Shell title="Settings">
      <form action={saveSettingsAction} className="panel">
        <label className="lbl">Shop name</label>
        <input className="field" name="shop_name" defaultValue={s.shop_name} />
        <label className="lbl">Labor rate $ / hour</label>
        <input className="field" name="labor_rate" defaultValue={(s.labor_rate_cents / 100).toFixed(2)} />
        <label className="lbl">IRS mileage rate (cents)</label>
        <input className="field" name="mileage_rate" defaultValue={String(s.mileage_rate_cents)} />
        <p className="mt-2 text-xs text-muted">
          Default is the current IRS business rate (76¢ from July 1, 2026). You can edit it.
        </p>
        <button className="tap mt-4" type="submit">
          Save settings
        </button>
      </form>
      <form action={resetDemoAction} className="mt-8">
        <p className="text-sm text-muted">
          Demo reset wipes the shop book and reloads the sample driveway jobs.
        </p>
        <button className="tap tap-red mt-3" type="submit">
          Reset demo data
        </button>
      </form>
    </Shell>
  );
}
