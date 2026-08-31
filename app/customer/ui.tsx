"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Mark } from "@/components/Mark";

function authMessage(err: { message?: string; code?: string } | null, fallback: string) {
  const code = (err?.code ?? "").toLowerCase();
  const msg = err?.message ?? "";
  if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) {
    return "Email not confirmed";
  }
  if (code === "invalid_credentials" || /invalid login/i.test(msg) || /invalid credentials/i.test(msg)) {
    return "Wrong email or password.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg) || /already exists/i.test(msg)) {
    return "An account with that email already exists. Sign in, or resend the confirmation email.";
  }
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg)) {
    return "Too many emails. Wait a minute, then try again.";
  }
  return msg.trim() || fallback;
}

function isUnconfirmed(err: { message?: string; code?: string } | null) {
  const code = (err?.code ?? "").toLowerCase();
  const msg = err?.message ?? "";
  return code === "email_not_confirmed" || /not confirmed/i.test(msg);
}

export function CustomerAuthForm({
  mode,
  sentEmail = "",
  confirmFailed = false,
}: {
  mode: "login" | "signup";
  sentEmail?: string;
  confirmFailed?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    confirmFailed ? "Confirmation link failed. Sign in, or resend the email." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [email, setEmail] = useState(sentEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState(sentEmail);

  const checkEmail = mode === "signup" && Boolean(sentTo);

  async function resend(to: string) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: to,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) {
        setError(authMessage(err, "Could not resend confirmation."));
        return;
      }
      setInfo(`Confirmation email sent to ${to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend confirmation.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setInfo(null);
    setUnconfirmed(false);
    setBusy(true);
    const trimmedEmail = email.trim();
    try {
      const supabase = createBrowserSupabase();
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { name: name.trim(), phone: phone.trim() },
          },
        });
        if (err) {
          setError(authMessage(err, "Could not create the account."));
          return;
        }
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError("An account with that email already exists. Sign in, or resend the confirmation email.");
          setUnconfirmed(true);
          return;
        }
        setSentTo(trimmedEmail);
        router.replace(`/customer/signup?sent=${encodeURIComponent(trimmedEmail)}`);
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (err) {
        setError(authMessage(err, "Could not sign in."));
        if (isUnconfirmed(err)) setUnconfirmed(true);
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

  if (checkEmail) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <Mark />
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
          Check your email
        </h1>
        <p className="mt-4 text-lg">
          Confirmation email sent to <span className="font-bold text-amber">{sentTo}</span>. Click the
          link, then sign in.
        </p>
        {info ? <p className="mt-3 text-green">{info}</p> : null}
        {error ? <p className="mt-3 text-red">{error}</p> : null}
        <button
          className="tap mt-8"
          type="button"
          disabled={busy}
          onClick={() => resend(sentTo)}
        >
          {busy ? "Sending…" : "Resend confirmation"}
        </button>
        <p className="mt-6 text-center text-sm text-muted">
          Confirmed?{" "}
          <Link className="text-amber" href="/customer/login">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Mark />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        {mode === "signup" ? "Create customer login" : "Customer login"}
      </h1>
      <p className="mt-2 text-muted">For driveway customers. Shop staff use the mechanic login.</p>
      <form onSubmit={onSubmit} className="mt-6">
        {mode === "signup" ? (
          <>
            <label className="lbl">Name</label>
            <input className="field" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
            <label className="lbl">Phone</label>
            <input
              className="field"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </>
        ) : null}
        <label className="lbl">Email</label>
        <input
          className="field"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="lbl">Password</label>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="mt-3 text-lg font-bold text-red">{error}</p> : null}
        {info ? <p className="mt-3 text-lg font-bold text-green">{info}</p> : null}
        {unconfirmed ? (
          <button
            className="tap tap-ghost mt-4"
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => resend(email.trim())}
          >
            {busy ? "Sending…" : "Resend confirmation"}
          </button>
        ) : null}
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
