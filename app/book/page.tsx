import { getCustomerUser } from "@/lib/supabase/server";
import { BookForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const user = await getCustomerUser();
  return (
    <BookForm
      signedIn={Boolean(user)}
      name={user ? String(user.user_metadata?.name ?? "") : undefined}
      phone={user ? String(user.user_metadata?.phone ?? "") : undefined}
    />
  );
}
