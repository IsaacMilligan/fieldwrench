import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/supabase/server";
import { CustomerAuthForm } from "../ui";

export default async function CustomerLoginPage() {
  const user = await getCustomerUser();
  if (user) redirect("/customer");
  return <CustomerAuthForm mode="login" />;
}
