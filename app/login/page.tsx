import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { LoginForm } from "./ui";

export default async function LoginPage() {
  const s = await readSession();
  if (s) redirect("/");
  return <LoginForm />;
}
