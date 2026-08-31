import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refreshCustomerSession } from "@/lib/supabase/proxy";

const PUBLIC = [
  /^\/login$/,
  /^\/book$/,
  /^\/i\//,
  /^\/api\/book/,
  /^\/api\/session/,
  /^\/api\/media\//,
  /^\/customer/,
  /^\/auth\//,
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const customerRes = await refreshCustomerSession(request);

  if (PUBLIC.some((r) => r.test(pathname))) return customerRes;

  if (pathname === "/jobs/new") {
    const url = request.nextUrl.clone();
    url.pathname = "/jobs";
    url.search = "?new=1";
    const redirect = NextResponse.redirect(url);
    customerRes.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (pathname === "/customers/new") {
    const url = request.nextUrl.clone();
    url.pathname = "/customers";
    url.search = "?new=1";
    const redirect = NextResponse.redirect(url);
    customerRes.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (pathname === "/receipts" || pathname === "/mileage" || pathname === "/settings") {
    const url = request.nextUrl.clone();
    url.pathname = "/more";
    url.search = `?tab=${pathname.slice(1)}`;
    const redirect = NextResponse.redirect(url);
    customerRes.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  const session = request.cookies.get("fw_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return customerRes;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
