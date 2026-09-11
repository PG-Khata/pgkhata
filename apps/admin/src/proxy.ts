import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed the `middleware` file convention to `proxy`; the export must
// be named `proxy` (or be the default export).
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md

const API_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Defence in depth behind the `(admin)/layout.tsx` server-side gate. This turns
 * an unauthenticated hit on a dashboard URL into a redirect before the route is
 * rendered at all, so a rendering bug can never leak the console.
 *
 * better-auth runs inside the Express API, so the only honest check here is to
 * forward the cookie and ask.
 */
export async function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  const deny = () => {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  };

  if (!cookie) return deny();

  try {
    const res = await fetch(new URL("/v1/admin/me", API_URL), {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return deny();
  } catch {
    // API unreachable — fail closed.
    return deny();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
