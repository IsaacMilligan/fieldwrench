import Link from "next/link";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export default async function MorePage() {
  await requireSession();
  const items = [
    ["/customers", "Customers"],
    ["/receipts", "Receipts"],
    ["/mileage", "Mileage"],
    ["/settings", "Settings"],
    ["/book", "Public booking page"],
  ];
  return (
    <Shell title="More">
      <ul className="space-y-3">
        {items.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="tap tap-steel flex items-center justify-center">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction} className="mt-10">
        <button className="tap tap-red" type="submit">
          Sign out
        </button>
      </form>
    </Shell>
  );
}
