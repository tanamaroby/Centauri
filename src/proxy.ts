import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // Sliding session: refresh the year-long cookie periodically so you never get logged out.
  if (session.renew) {
    response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except the login page, auth API, static assets and PWA files.
    "/((?!login|api/auth|_next/static|_next/image|icons/|favicon.ico|manifest.webmanifest|sw.js|offline.html|pdf.worker.min.mjs|robots.txt).*)",
  ],
};
