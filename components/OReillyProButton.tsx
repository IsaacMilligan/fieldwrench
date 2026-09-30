import { OREILLY_PRO_URL } from "@/lib/oil-specs";

/**
 * O'Reilly Pro is login-gated and has no public vehicle/YMM deep link, so this opens the
 * pro home in a new tab. The tech looks the spec up there and saves it back here.
 */
export function OReillyProButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={OREILLY_PRO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`tap tap-ghost flex items-center justify-center ${className}`}
    >
      Look up in O&apos;Reilly Pro ↗
    </a>
  );
}
