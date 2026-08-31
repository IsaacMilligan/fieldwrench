import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { LoginForm } from "./ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const s = await readSession();
  if (s) redirect("/");
  const q = await searchParams;
  return <LoginForm failed={q.e === "1"} />;
}
