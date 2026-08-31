"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Mark } from "@/components/Mark";

export function CustomerAuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    try {
      const supabase = createBrowserSupabase();
      if (mode === "signup") {
        const origin = window.location.origin;
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback`,
            data: { name, phone },
          },
        });
        if (err) {
          setError(err.message);
          return;
        }
        setInfo("Check your email to confirm, then sign in. If confirmation is off, you can sign in now.");
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      router.push("/customer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Mark />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        {mode === "signup" ? "Create customer login" : "Customer login"}
      </h1>
      <p className="mt-2 text-muted">
        For driveway customers. Shop staff use the mechanic login.
      </p>
      <form onSubmit={onSubmit} className="mt-6">
        {mode === "signup" ? (
          <>
            <label className="lbl">Name</label>
            <input className="field" name="name" required />
            <label className="lbl">Phone</label>
            <input className="field" name="phone" type="tel" />
          </>
        ) : null}
        <label className="lbl">Email</label>
        <input className="field" name="email" type="email" autoComplete="email" required />
        <label className="lbl">Password</label>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          required
        />
        {error ? <p className="mt-3 text-red">{error}</p> : null}
        {info ? <p className="mt-3 text-green">{info}</p> : null}
        <button className="tap mt-6" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have a login?{" "}
            <Link className="text-amber" href="/customer/login">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link className="text-amber" href="/customer/signup">
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="mt-3 text-center text-sm">
        <Link className="text-steel" href="/book">
          Book without an account
        </Link>
      </p>
    </div>
  );
}
