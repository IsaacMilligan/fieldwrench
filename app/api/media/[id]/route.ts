import { NextResponse } from "next/server";
import { db } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sql = await db();
  const [row] = await sql<{ bytes: Buffer | null; content_type: string; url: string }[]>`
    SELECT bytes, content_type, url FROM photos WHERE id = ${id}
  `;
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (row.url) return NextResponse.redirect(row.url);
  if (!row.bytes) return new NextResponse("Not found", { status: 404 });
  const raw = row.bytes as unknown as ArrayBuffer | Uint8Array;
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": row.content_type || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}
