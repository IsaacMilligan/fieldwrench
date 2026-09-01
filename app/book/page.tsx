import { getCustomerUser } from "@/lib/supabase/server";
import { getSettings, listCustomerGarage } from "@/lib/db/queries";
import { earliestBookDateISO, normalizeLeadHours } from "@/lib/format";
import { BookForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const user = await getCustomerUser();
  const q = await searchParams;
  const settings = await getSettings().catch(() => ({ lead_hours: 24 }));
  const leadHours = normalizeLeadHours(settings.lead_hours ?? 24);
  const minDate = earliestBookDateISO(leadHours);
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
      savedVehicles={savedVehicles}
      minDate={minDate}
      leadHours={leadHours}
    />
  );
}
