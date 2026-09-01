"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconJobs() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="7" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconCustomers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5v2.2M12 18.3V21M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ITEMS = [
  { href: "/", label: "Home", match: "home", Icon: IconHome },
  { href: "/jobs", label: "Jobs", match: "jobs", Icon: IconJobs },
  { href: "/calendar", label: "Calendar", match: "calendar", Icon: IconCalendar },
  { href: "/customers", label: "Customers", match: "customers", Icon: IconCustomers },
  { href: "/jobs?new=1", label: "New job", match: "new", Icon: IconPlus },
  { href: "/more?tab=settings", label: "Settings", match: "settings", Icon: IconSettings },
] as const;

export function Nav() {
  const path = usePathname() || "/";
  const q = useSearchParams();
  const isNewJob = path.startsWith("/jobs") && q.get("new") === "1";
  const isSettings = path.startsWith("/more");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-amber bg-[var(--nav)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-6">
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
                    : it.match === "settings"
                      ? isSettings
                      : path.startsWith("/customers");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 pt-1 text-[9px] font-extrabold uppercase tracking-[0.06em] ${
                on ? "text-amber" : "text-muted"
              }`}
            >
              <it.Icon />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
