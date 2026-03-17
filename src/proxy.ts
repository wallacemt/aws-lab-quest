import { NextRequest, NextResponse } from "next/server";

const AUTH_PAGES = ["/login", "/register"];
const PUBLIC_PREFIXES = [
  "/api/auth",
  "/_next",
  "/favicon",
  "/share",
  "/icon",
  "/apple-icon",
  "/twitter-image",
  "/og-image",
];
const PUBLIC_EXACT_PATHS = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];

// Better Auth may prefix secure cookies in production environments.
 const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
];

function hasSessionCookie(request: NextRequest) {
  if (SESSION_COOKIE_NAMES.some((cookieName) => Boolean(request.cookies.get(cookieName)?.value))) {
    return true;
  }

  // Fallback for deployments that may rename/prefix cookies.
  return request.cookies.getAll().some((cookie) => cookie.name.endsWith("better-auth.session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets and auth API routes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || PUBLIC_EXACT_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const hasSession = hasSessionCookie(request);

  if (!hasSession && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname !== "/login" ? pathname : "/");
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)"],
};
