import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db/queries";
import { getPrivateBlob } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sess = await readSession();
  if (!sess) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const sql = await db();
  const [row] = await sql<{
    bytes: Buffer | null;
    content_type: string;
    url: string;
    pathname: string | null;
    shop_id: string | null;
  }[]>`
    SELECT p.bytes, p.content_type, p.url, p.pathname, p.shop_id
    FROM photos p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = ${id} AND j.shop_id = ${sess.shopId}
  `;
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (row.bytes) {
    const raw = row.bytes as unknown as ArrayBuffer | Uint8Array;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "content-type": row.content_type || "image/jpeg",
        "cache-control": "private, max-age=86400",
      },
    });
  }
  const key = (row.pathname && row.pathname.trim()) || row.url;
  if (!key) return new NextResponse("Not found", { status: 404 });
  try {
    const got = await getPrivateBlob(key);
    if (!got?.stream) return new NextResponse("Not found", { status: 404 });
    return new Response(got.stream as unknown as BodyInit, {
      headers: {
        "content-type": got.blob?.contentType || row.content_type || "image/jpeg",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("media get", e instanceof Error ? e.message : e);
    return new NextResponse("Not found", { status: 404 });
  }
}
