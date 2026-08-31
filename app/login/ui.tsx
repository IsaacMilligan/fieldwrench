"use client";

import { useActionState } from "react";
import { demoLoginAction, loginAction } from "@/lib/actions";
import { Mark } from "@/components/Mark";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <Mark big />
      <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        Open the van
      </h1>
      <p className="mt-2 text-muted">Mechanic login. Public booking and invoice links stay open.</p>

      <form action={demoLoginAction} className="mt-8">
        <button className="tap" type="submit">
          Enter shop
        </button>
        <p className="mt-2 text-center text-sm text-muted">
          Demo: wrench@fieldwrench.local / driveway
        </p>
      </form>

      <form action={action} className="mt-8">
        <label className="lbl" htmlFor="email">
          Email
        </label>
        <input className="field" id="email" name="email" type="email" autoComplete="username" required />
        <label className="lbl" htmlFor="password">
          Password
        </label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state?.error ? <p className="mt-3 text-red">{state.error}</p> : null}
        <button className="tap tap-ghost mt-6" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
