import Link from "next/link";
import { Mark } from "@/components/Mark";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <Mark />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold uppercase">
        Not found
      </h1>
      <p className="mt-3 text-muted">That page or invoice link does not exist.</p>
      <Link href="/book" className="tap mt-6 flex items-center justify-center">
        Book a visit
      </Link>
    </div>
  );
}
