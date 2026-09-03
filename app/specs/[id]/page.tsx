import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { getShopSpecById } from "@/lib/db/queries";
import { OilSpecCard } from "@/components/OilSpecCard";

export const dynamic = "force-dynamic";

function Fact({ label, value }: { label: string; value?: string | null }) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return (
    <p className="mt-1 text-sm">
      <span className="text-muted">{label} </span>
      {v}
    </p>
  );
}

export default async function SpecPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const spec = await getShopSpecById(id);
  if (!spec) notFound();
  return (
    <Shell title="Shop spec">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase">
        {spec.year} {spec.make_label} {spec.model_label}
      </h1>
      {spec.engine_label ? <p className="mt-1 text-lg">{spec.engine_label}</p> : null}
      <Fact label="Trim" value={spec.trim} />
      <Fact label="Body" value={spec.body} />
      <Fact label="Drive" value={spec.drive} />
      {spec.vin ? <p className="mt-1 font-mono text-sm text-muted">{spec.vin}</p> : null}
      <p className="mt-3 text-sm text-muted">No customer. Saved for this engine in your shop library.</p>
      <OilSpecCard
        specId={spec.id}
        engine={spec.engine_label}
        savedQt={spec.oil_qt}
        savedViscosity={spec.oil_viscosity}
        savedTq={spec.oil_drain_tq}
        savedSocket={spec.oil_socket}
      />
    </Shell>
  );
}
