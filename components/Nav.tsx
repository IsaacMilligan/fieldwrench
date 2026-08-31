"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/bookings", label: "Book" },
  { href: "/tools", label: "Tools" },
  { href: "/more", label: "More" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-amber bg-[#0c0d0a]">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((it) => {
          const on =
            it.href === "/"
              ? path === "/"
              : path === it.href || path.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex min-h-16 flex-col items-center justify-center text-[11px] font-extrabold uppercase tracking-[0.14em] ${
                on ? "text-amber" : "text-muted"
              }`}
            >
              <span
                className={`mb-1 h-1 w-8 rounded-full ${on ? "bg-amber" : "bg-transparent"}`}
              />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
