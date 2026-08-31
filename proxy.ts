import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = [/^\/login$/, /^\/book$/, /^\/i\//, /^\/api\/book/, /^\/api\/media\//];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const session = request.cookies.get("fw_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
