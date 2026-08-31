import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.DATABASE_URL || "";
  let host = "missing";
  try {
    host = new URL(raw.replace(/^postgres(ql)?:/i, "https:")).host;
  } catch {
    host = "unparseable";
  }
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(raw, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 5,
    });
    const rows = await sql`select 1 as n`;
    await sql.end({ timeout: 2 });
    return NextResponse.json({ ok: true, host, len: raw.length, n: rows[0]?.n });
  } catch (e) {
    const err = e as { message?: string; name?: string; code?: string; cause?: unknown };
    return NextResponse.json(
      {
        ok: false,
        host,
        len: raw.length,
        error: err?.message || String(e),
        name: err?.name,
        code: err?.code,
        cause: err?.cause ? String(err.cause) : undefined,
      },
      { status: 500 },
    );
  }
}
