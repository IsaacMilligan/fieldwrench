import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { listShopVehicles } from "@/lib/db/queries";
import { vehicleLabel } from "@/lib/format";
import { VinTool } from "./ui";

export const dynamic = "force-dynamic";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ vin?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const vehicles = await listShopVehicles();
  return (
    <Shell title="Tools">
      <VinTool
        defaultVin={sp.vin}
        vehicles={vehicles.map((v) => ({
          id: String(v.id),
          vin: String(v.vin ?? ""),
          label: `${v.name} · ${vehicleLabel({ year: v.year as number, make: String(v.make), model: String(v.model) })}`,
        }))}
      />
    </Shell>
  );
}
