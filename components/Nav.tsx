"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function IconHome({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconJobs({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <rect x="4" y="7" width="16" height="13" rx="2" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M4 12h16" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
    </svg>
  );
}

function IconCalendar({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCustomers({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M21.5 19c-.4-2.2-2-3.7-3.8-4" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus({ on }: { on: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke={on ? "#e8a317" : "#9aa08c"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ITEMS = [
  { href: "/", label: "Home", match: "home", Icon: IconHome },
  { href: "/jobs", label: "Jobs", match: "jobs", Icon: IconJobs },
  { href: "/calendar", label: "Calendar", match: "calendar", Icon: IconCalendar },
  { href: "/customers", label: "Customers", match: "customers", Icon: IconCustomers },
  { href: "/jobs?new=1", label: "New job", match: "new", Icon: IconPlus },
] as const;

export function Nav() {
  const path = usePathname() || "/";
  const q = useSearchParams();
  const isNewJob = path.startsWith("/jobs") && q.get("new") === "1";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-amber bg-[#0c0d0a] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((it) => {
          const on =
            it.match === "home"
              ? path === "/"
              : it.match === "new"
                ? isNewJob
                : it.match === "jobs"
                  ? path.startsWith("/jobs") && !isNewJob
                  : it.match === "calendar"
                    ? path.startsWith("/calendar")
                    : path.startsWith("/customers");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                on ? "text-amber" : "text-muted"
              }`}
            >
              <it.Icon on={on} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
