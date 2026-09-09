"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const db =
    /database|postgres|connection closed|credentials/i.test(error?.message || "") &&
    !/malformed array/i.test(error?.message || "");
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase">
        {db ? "Shop could not load" : "This screen failed"}
      </h1>
      <p className="mt-3 text-lg text-muted">
        {db
          ? "The shop book could not reach the database. Public booking still works. Retry, or sign in again."
          : "Public booking still works. Retry this screen — your jobs and customers are still there."}
      </p>
      <button className="tap mt-6" type="button" onClick={() => reset()}>
        Retry
      </button>
      <a className="tap tap-ghost mt-3 flex items-center justify-center" href="/login">
        Mechanic login
      </a>
    </div>
  );
}
