import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/supabase/server";
import { CustomerAuthForm } from "../ui";

export const dynamic = "force-dynamic";

export default async function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await getCustomerUser();
  if (user) redirect("/customer");
  const q = await searchParams;
  return <CustomerAuthForm mode="signup" sentEmail={q.sent ?? ""} />;
}
