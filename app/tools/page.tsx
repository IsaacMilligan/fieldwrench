import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db/queries";
import { vehicleLabel } from "@/lib/format";
import { DTC_CODES } from "@/lib/dtc";
import { DtcTool, VinTool } from "./ui";

export const dynamic = "force-dynamic";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ vin?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const sql = await db();
  const vehicles = await sql`
    SELECT v.id, v.year, v.make, v.model, c.name
    FROM vehicles v JOIN customers c ON c.id = v.customer_id
    ORDER BY c.name
  `;
  return (
    <Shell title="Tools">
      <VinTool
        defaultVin={sp.vin}
        vehicles={vehicles.map((v) => ({
          id: String(v.id),
          label: `${v.name} · ${vehicleLabel({ year: v.year as number, make: String(v.make), model: String(v.model) })}`,
        }))}
      />
      <DtcTool initial={DTC_CODES} />
    </Shell>
  );
}
