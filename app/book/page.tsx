import { getCustomerUser } from "@/lib/supabase/server";
import { listCustomerGarage } from "@/lib/db/queries";
import { BookForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const user = await getCustomerUser();
  const q = await searchParams;
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
      savedVehicles={savedVehicles}
    />
  );
}
