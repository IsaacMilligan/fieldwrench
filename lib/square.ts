export type SquareEnv = {
  token: string;
  locationId: string;
  environment: "sandbox" | "production";
};

export type SquareInvoiceStatus = "not_sent" | "sent" | "partially_paid" | "paid" | "canceled" | "failed";

const SQUARE_VERSION = "2025-10-16";

export function squareEnv(): SquareEnv | null {
  const token = String(process.env["SQUARE_ACCESS_TOKEN"] || "").trim();
  const locationId = String(process.env["SQUARE_LOCATION_ID"] || "").trim();
  if (!token || !locationId) return null;
  const raw = String(process.env["SQUARE_ENVIRONMENT"] || "sandbox").trim().toLowerCase();
  const environment = raw === "production" ? "production" : "sandbox";
  return { token, locationId, environment };
}

export function squareConfigured(): boolean {
  return squareEnv() != null;
}

function squareBase(env: SquareEnv): string {
  return env.environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

type SquareErr = { category?: string; code?: string; detail?: string; field?: string };

async function squareFetch<T>(env: SquareEnv, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${squareBase(env)}${path}`, {
    ...init,
    headers: {
      "Square-Version": SQUARE_VERSION,
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as { errors?: SquareErr[] } & T;
  if (!res.ok) {
    const errs = json.errors || [];
    console.error("square", path, res.status, JSON.stringify(errs));
    const e = errs[0];
    const field = e?.field ? ` (${e.field})` : "";
    const msg = `${e?.detail || e?.code || `Square HTTP ${res.status}`}${field}`;
    const err = new Error(msg);
    err.name = e?.code || "SquareError";
    throw err;
  }
  return json;
}

function splitName(name: string): { given: string; family: string } {
  const bits = name.trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return { given: "Customer", family: "" };
  if (bits.length === 1) return { given: bits[0], family: "" };
  return { given: bits[0], family: bits.slice(1).join(" ") };
}

function phoneE164(raw: string): string | undefined {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10) return `+${d}`;
  return undefined;
}

export function mapSquareInvoiceStatus(raw: string | undefined): SquareInvoiceStatus {
  const s = String(raw || "").toUpperCase();
  if (s === "PAID") return "paid";
  if (s === "PARTIALLY_PAID") return "partially_paid";
  if (s === "CANCELED" || s === "CANCELLED") return "canceled";
  if (s === "FAILED") return "failed";
  if (s === "UNPAID" || s === "SCHEDULED" || s === "PAYMENT_PENDING") return "sent";
  if (s === "DRAFT") return "sent";
  return "sent";
}

export async function squareCreateCustomer(
  env: SquareEnv,
  input: { name: string; phone?: string; email?: string },
): Promise<string> {
  const { given, family } = splitName(input.name || "Customer");
  const body: Record<string, unknown> = {
    idempotency_key: crypto.randomUUID(),
    given_name: given,
    family_name: family || undefined,
  };
  const phone = input.phone ? phoneE164(input.phone) : undefined;
  if (phone) body.phone_number = phone;
  const email = String(input.email || "").trim();
  if (email.includes("@")) body.email_address = email;
  const out = await squareFetch<{ customer?: { id?: string } }>(env, "/v2/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = out.customer?.id;
  if (!id) throw new Error("Square did not return a customer.");
  return id;
}

export async function squareCreateOrder(
  env: SquareEnv,
  input: { name: string; amountCents: number },
): Promise<string> {
  const amount = Math.max(0, Math.round(input.amountCents));
  if (!amount) throw new Error("Invoice total is $0.00 — nothing to send.");
  const out = await squareFetch<{ order?: { id?: string } }>(env, "/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: env.locationId,
        line_items: [
          {
            name: input.name.slice(0, 120) || "Driveway service",
            quantity: "1",
            base_price_money: { amount, currency: "USD" },
          },
        ],
      },
    }),
  });
  const id = out.order?.id;
  if (!id) throw new Error("Square did not return an order.");
  return id;
}

function denverDayPlus(days: number): string {
  const now = new Date();
  const denver = new Date(now.getTime() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(denver);
}

export type SquareInvoiceRecord = {
  id: string;
  version: number;
  status: string;
  publicUrl: string;
  orderId: string;
};

function parseInvoice(raw: {
  id?: string;
  version?: number;
  status?: string;
  public_url?: string;
  order_id?: string;
} | undefined): SquareInvoiceRecord {
  const id = raw?.id;
  if (!id) throw new Error("Square did not return an invoice.");
  return {
    id,
    version: Number(raw?.version ?? 0) || 0,
    status: String(raw?.status || "DRAFT"),
    publicUrl: String(raw?.public_url || ""),
    orderId: String(raw?.order_id || ""),
  };
}

export async function squareCreateInvoice(
  env: SquareEnv,
  input: {
    orderId: string;
    customerId: string;
    title: string;
    description: string;
    publish: boolean;
  },
): Promise<SquareInvoiceRecord> {
  const created = await squareFetch<{ invoice?: { id?: string; version?: number; status?: string; public_url?: string; order_id?: string } }>(
    env,
    "/v2/invoices",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        invoice: {
          location_id: env.locationId,
          order_id: input.orderId,
          primary_recipient: { customer_id: input.customerId },
          delivery_method: "SHARE_MANUALLY",
          title: input.title.slice(0, 100) || "Driveway service",
          description: input.description.slice(0, 2000),
          payment_requests: [
            {
              request_type: "BALANCE",
              due_date: denverDayPlus(7),
              tipping_enabled: false,
              automatic_payment_source: "NONE",
            },
          ],
          accepted_payment_methods: {
            card: true,
            square_gift_card: false,
            bank_account: false,
          },
        },
      }),
    },
  );
  let rec = parseInvoice(created.invoice);
  if (!input.publish) return rec;
  const published = await squareFetch<{ invoice?: { id?: string; version?: number; status?: string; public_url?: string; order_id?: string } }>(
    env,
    `/v2/invoices/${encodeURIComponent(rec.id)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ version: rec.version, idempotency_key: crypto.randomUUID() }),
    },
  );
  rec = parseInvoice(published.invoice);
  return rec;
}

export async function squareGetInvoice(env: SquareEnv, invoiceId: string): Promise<SquareInvoiceRecord> {
  const out = await squareFetch<{ invoice?: { id?: string; version?: number; status?: string; public_url?: string; order_id?: string } }>(
    env,
    `/v2/invoices/${encodeURIComponent(invoiceId)}`,
  );
  return parseInvoice(out.invoice);
}

export function squareUserMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not configured|SQUARE_/i.test(msg)) return "Connect Square in Settings / Vercel env.";
  return (msg || "Square request failed.").slice(0, 180);
}
