import { getCustomerUser } from "@/lib/supabase/server";
import { BookForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const user = await getCustomerUser();
  const q = await searchParams;
  return (
    <BookForm
      signedIn={Boolean(user)}
      name={user ? String(user.user_metadata?.name ?? "") : undefined}
      phone={user ? String(user.user_metadata?.phone ?? "") : undefined}
      ok={q.ok === "1"}
      failed={q.e === "1"}
    />
  );
}
