import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listCalendarMonth } from "@/lib/db/queries";
import { denverDateISO, vehicleLabel } from "@/lib/format";
import { formatServiceList, parseServiceIds } from "@/lib/services";
import { CalendarMonth, type CalItem } from "./CalendarMonth";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  await requireSession();
  const q = await searchParams;
  const today = denverDateISO();
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(q.y) || ty;
  const month = Number(q.m) || tm;
  const { jobs, bookings } = await listCalendarMonth(year, month);
  const items: CalItem[] = [
    ...jobs.map((j) => ({
      kind: "job" as const,
      id: String(j.id),
      day: String(j.day),
      customer: String(j.customer_name),
      vehicle: vehicleLabel({ year: j.year, make: j.make, model: j.model }) + (j.engine ? ` ${j.engine}` : ""),
      services: formatServiceList(parseServiceIds(j.services)),
      href: `/jobs/${j.id}`,
      status: String(j.status ?? ""),
    })),
    ...bookings.map((b) => ({
      kind: "booking" as const,
      id: String(b.id),
      day: String(b.day),
      customer: String(b.name),
      vehicle:
        vehicleLabel({
          year: b.vehicle_year,
          make: b.vehicle_make,
          model: b.vehicle_model,
        }) || String(b.vehicle || ""),
      services: formatServiceList(parseServiceIds(b.services)),
      href: "/bookings",
    })),
  ];
  return (
    <Shell title="Calendar">
      <CalendarMonth year={year} month={month} today={today} items={items} />
    </Shell>
  );
}
