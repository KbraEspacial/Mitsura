import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/register"];

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const encoded = parts[1];
    if (!encoded) return false;
    const payload = JSON.parse(atob(encoded));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const isPublic = publicRoutes.some((r) => request.nextUrl.pathname.startsWith(r));
  const hasValidSession = !!session && isTokenValid(session);

  if (!hasValidSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasValidSession && isPublic) {
    return NextResponse.redirect(new URL("/boards", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|img/).*)"],
};
