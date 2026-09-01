"use client";

import { Mark } from "@/components/Mark";
import { PasswordField } from "@/components/PasswordField";

export function LoginForm({ failed, dbDown }: { failed?: boolean; dbDown?: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <Mark big />
      <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase tracking-wide">
        Open the van
      </h1>
      <p className="mt-2 text-muted">Mechanic login. Public booking and invoice links stay open.</p>

      <form action="/api/session" method="post" className="mt-8">
        <input type="hidden" name="demo" value="1" />
        <button className="tap" type="submit">
          Enter shop
        </button>
        <p className="mt-2 text-center text-sm text-muted">
          Demo: wrench@fieldwrench.local / driveway
        </p>
      </form>

      <form action="/api/session" method="post" className="mt-8">
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
        <button className="tap tap-ghost mt-6" type="submit">
          Sign in
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Driveway customer?{" "}
        <a className="text-amber" href="/customer/login">
          Customer login
        </a>
      </p>
    </div>
  );
}
