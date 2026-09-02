"use client";

import { useState } from "react";
import { Mark } from "@/components/Mark";
import { PasswordField } from "@/components/PasswordField";

export function LoginForm({
  failed,
  dbDown,
  canSignup,
  signupError,
}: {
  failed?: boolean;
  dbDown?: boolean;
  canSignup?: boolean;
  signupError?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(signupError ? "signup" : "signin");
  const signup = canSignup && mode === "signup";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <Mark big />
      <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        Open the van
      </h1>
      <p className="mt-2 text-muted">Mechanic login. Public booking and invoice links stay open.</p>

      <form action="/api/session" method="post" className="mt-8">
        <input type="hidden" name="demo" value="1" />
        <button className="tap tap-ghost" type="submit">
          Demo
        </button>
        <p className="mt-2 text-center text-sm text-muted">
          Demo shop only — wrench@fieldwrench.local / driveway. Does not touch a real mechanic account.
        </p>
      </form>

      {canSignup ? (
        <div className="mt-8 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={mode === "signin" ? "tap" : "tap tap-ghost"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "tap" : "tap tap-ghost"}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">Sign in to this shop. New mechanic signups are closed.</p>
      )}

      {signup ? (
        <form action="/api/session" method="post" className="mt-6">
          <input type="hidden" name="signup" value="1" />
          <label className="lbl" htmlFor="name">
            Name
          </label>
          <input className="field" id="name" name="name" autoComplete="name" required />
          <label className="lbl" htmlFor="email">
            Email
          </label>
          <input className="field" id="email" name="email" type="email" autoComplete="username" required />
          <label className="lbl" htmlFor="password">
            Password
          </label>
          <PasswordField id="password" name="password" autoComplete="new-password" required minLength={8} />
          <label className="lbl" htmlFor="password2">
            Confirm password
          </label>
          <PasswordField id="password2" name="password2" autoComplete="new-password" required minLength={8} />
          {signupError ? <p className="mt-3 text-red">{signupError}</p> : null}
          <button className="tap mt-6" type="submit">
            Create account
          </button>
        </form>
      ) : (
        <form action="/api/session" method="post" className="mt-6">
          <label className="lbl" htmlFor="email">
            Email
          </label>
          <input className="field" id="email" name="email" type="email" autoComplete="username" required />
          <label className="lbl" htmlFor="password">
            Password
          </label>
          <PasswordField id="password" name="password" autoComplete="current-password" required />
          {dbDown ? (
            <p className="mt-3 text-red">Shop database is unreachable. Try again in a minute.</p>
          ) : failed ? (
            <p className="mt-3 text-red">Wrong email or password.</p>
          ) : null}
          <button className="tap mt-6" type="submit">
            Sign in
          </button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted">
        Driveway customer?{" "}
        <a className="text-amber" href="/customer/login">
          Customer login
        </a>
      </p>
    </div>
  );
}
