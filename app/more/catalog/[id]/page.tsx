import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getCatalogItem } from "@/lib/db/queries";
import { CatalogEditForm } from "../../CatalogEditForm";

export const dynamic = "force-dynamic";

export default async function CatalogItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  if (id === "new") {
    return (
      <Shell title="New item">
        <Link href="/more?tab=settings" className="text-sm font-bold text-amber">
          ← Item catalog
        </Link>
        <div className="mt-4">
          <CatalogEditForm />
        </div>
      </Shell>
    );
  }
  const item = await getCatalogItem(id);
  if (!item) notFound();
  return (
    <Shell title="Edit item">
      <Link href="/more?tab=settings" className="text-sm font-bold text-amber">
        ← Item catalog
      </Link>
      <div className="mt-4">
        <CatalogEditForm item={item} />
      </div>
    </Shell>
  );
}
