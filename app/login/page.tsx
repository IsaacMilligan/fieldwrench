import { redirect } from "next/navigation";
import { ownerExists, readSession } from "@/lib/auth";
import { LoginForm } from "./ui";

const SIGNUP_ERRORS: Record<string, string> = {
  closed: "This shop already has an owner. Ask them to add you.",
  exists: "That email already has an account. Sign in instead.",
  mismatch: "Passwords do not match.",
  short: "Password must be at least 8 characters.",
  invalid: "Enter your name, email, and a password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const s = await readSession();
  if (s) redirect("/");
  const q = await searchParams;
  const canSignup = !(await ownerExists());
  return (
    <LoginForm
      failed={q.e === "1"}
      dbDown={q.e === "db"}
      canSignup={canSignup}
      signupError={q.e && SIGNUP_ERRORS[q.e] ? SIGNUP_ERRORS[q.e] : undefined}
    />
  );
}
