import { NextResponse } from "next/server";
import { ensureReady, getSql } from "@/lib/db/index";

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
    await ensureReady();
    const sql = getSql();
    const [users] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users`;
    const [jobs] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM jobs`;
    return NextResponse.json({
      ok: true,
      host,
      len: raw.length,
      users: users?.n ?? 0,
      jobs: jobs?.n ?? 0,
    });
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
