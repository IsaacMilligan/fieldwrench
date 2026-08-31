import { Mark } from "./Mark";
import { Nav } from "./Nav";

export function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Mark />
        {title ? (
          <div className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-widest text-steel">
            {title}
          </div>
        ) : null}
      </header>
      <main className="px-4 py-4">{children}</main>
      <Nav />
    </div>
  );
}
