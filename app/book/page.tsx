import { getCustomerUser } from "@/lib/supabase/server";
import { getSettings, listCustomerGarage, listDayLoads } from "@/lib/db/queries";
import { earliestBookDateISO, normalizeLeadHours } from "@/lib/format";
import {
  addDaysISO,
  DEFAULT_BUFFER_MIN,
  DEFAULT_HOURS,
  DEFAULT_RADIUS_MI,
  isShopOpenOn,
  maxJobsOnDay,
  parseHours,
} from "@/lib/schedule";
import { BookForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const user = await getCustomerUser();
  const q = await searchParams;
  const settings = await getSettings().catch(() => ({
    lead_hours: 24,
    hours: DEFAULT_HOURS,
    job_buffer_min: DEFAULT_BUFFER_MIN,
    service_radius_mi: DEFAULT_RADIUS_MI,
  }));
  const leadHours = normalizeLeadHours(settings.lead_hours ?? 24);
  const minDate = earliestBookDateISO(leadHours);
  const hours = parseHours(settings.hours ?? DEFAULT_HOURS);
  const buffer = Number(settings.job_buffer_min) || DEFAULT_BUFFER_MIN;
  const radiusMi = Number(settings.service_radius_mi) || DEFAULT_RADIUS_MI;
  const closedWeekdays = hours.map((h, i) => (h.open ? -1 : i)).filter((i) => i >= 0);
  const loads = await listDayLoads(minDate).catch(() => new Map<string, number>());
  const fullDates: string[] = [];
  for (let i = 0; i < 90; i++) {
    const iso = addDaysISO(minDate, i);
    if (!isShopOpenOn(hours, iso)) continue;
    const cap = maxJobsOnDay(hours, iso, buffer);
    if ((loads.get(iso) ?? 0) >= cap) fullDates.push(iso);
  }
  const savedVehicles = user?.email
    ? (await listCustomerGarage(user.email)).vehicles.map((v) => ({
        year: v.year,
        make: v.make,
        model: v.model,
      }))
    : [];
  return (
    <BookForm
      signedIn={Boolean(user)}
      name={user ? String(user.user_metadata?.name ?? "") : undefined}
      phone={user ? String(user.user_metadata?.phone ?? "") : undefined}
      ok={q.ok === "1"}
      failed={q.e === "1"}
      leadRejected={q.e === "lead"}
      closedRejected={q.e === "closed"}
      fullRejected={q.e === "full"}
      areaRejected={q.e === "area"}
      addressRejected={q.e === "address"}
      savedVehicles={savedVehicles}
      minDate={minDate}
      leadHours={leadHours}
      closedWeekdays={closedWeekdays}
      fullDates={fullDates}
      radiusMi={radiusMi}
    />
  );
}
