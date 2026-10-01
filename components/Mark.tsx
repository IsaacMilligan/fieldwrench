import Link from "next/link";

export function Mark({ big = false }: { big?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <svg width={big ? 48 : 36} height={big ? 48 : 36} viewBox="0 0 48 48" aria-hidden>
        <rect x="2" y="2" width="44" height="44" rx="4" fill="#1E3354" stroke="#FF6A13" strokeWidth="3" />
        <path d="M14 18h8l2 4 6-10 4 2-8 14h-8l-2-4-4 4-2-2 4-8z" fill="#FF6A13" />
        <path d="M10 34h28" stroke="#C3CEDD" strokeWidth="3" />
      </svg>
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-display)] font-extrabold tracking-[0.18em] text-amber"
          style={{ fontSize: big ? 28 : 18 }}
        >
          FIELDWRENCH
        </span>
        <span className="block text-[11px] font-bold tracking-[0.22em] uppercase text-muted">
          Driveway shop book
        </span>
      </span>
    </Link>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "amber" | "green" | "red" | "steel";
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
