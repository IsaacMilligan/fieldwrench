import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/supabase/server";
import { CustomerAuthForm } from "../ui";

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const user = await getCustomerUser();
  if (user) redirect("/customer");
  const q = await searchParams;
  return <CustomerAuthForm mode="login" confirmFailed={q.e === "confirm"} />;
}
