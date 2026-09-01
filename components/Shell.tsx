import { Suspense } from "react";
import { Mark } from "./Mark";
import { Nav } from "./Nav";

export function Shell({
  children,
  title,
  hideHeader = false,
}: {
  children: React.ReactNode;
  title?: string;
  hideHeader?: boolean;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      {hideHeader ? null : (
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <Mark />
          {title ? (
            <div className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-widest text-steel">
              {title}
            </div>
          ) : null}
        </header>
      )}
      <main className={hideHeader ? "px-4 pb-4" : "px-4 py-4"}>{children}</main>
      <Suspense fallback={null}>
        <Nav />
      </Suspense>
    </div>
  );
}
