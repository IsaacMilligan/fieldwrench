import { notFound } from "next/navigation";
import { Mark } from "@/components/Mark";
import { InvoiceSheet } from "@/components/InvoiceSheet";
import { getInvoiceByToken } from "@/lib/db/queries";
import { formatDate, money } from "@/lib/format";
import { PAY_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function PublicInvoice({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data: Awaited<ReturnType<typeof getInvoiceByToken>> = null;
  try {
    data = await getInvoiceByToken(token);
  } catch {
    notFound();
  }
  if (!data?.bundle) notFound();
  const { invoice, bundle, settings } = data;
  const paid = invoice.status === "paid";
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-8">
      <Mark />
      <div className={`panel mt-6 ${paid ? "" : ""}`} style={{ borderWidth: 2, borderColor: paid ? "#4ee06a" : "#ff5340" }}>
        <div className={`num text-5xl ${paid ? "text-green" : "text-red"}`}>{paid ? "PAID" : "UNPAID"}</div>
        <div className="num mt-1 text-3xl">{money(bundle.profit.invoicedTotal)}</div>
        {paid && invoice.paid_method ? (
          <div className="mt-2 text-sm text-muted">
            {PAY_LABEL[invoice.paid_method]} · {formatDate(invoice.paid_at)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Pay the mechanic directly. This link is a receipt, not a checkout.</p>
        )}
      </div>
      <div className="mt-4">
        <InvoiceSheet bundle={bundle} invoice={invoice} shop={settings.shop_name} />
      </div>
    </div>
  );
}
