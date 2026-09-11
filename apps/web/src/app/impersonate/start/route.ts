import { NextResponse, type NextRequest } from "next/server"

const API_URL = process.env.API_URL || "http://localhost:3001"

/**
 * Exchanges a one-time handoff token for the support-session cookie.
 *
 * This runs server-side so the token never reaches client JavaScript, and the
 * browser ends on /dashboard rather than keeping the token in the address bar
 * or the history. The token is single-use with a 60-second life, so a leaked
 * URL is worthless the moment it has been followed once.
 *
 * The cookie must be set on *this* origin: the session cookie is host-only, so
 * a grant minted on the admin origin is not sent here. That is the whole reason
 * for the handoff rather than a shared cookie domain.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.redirect(new URL("/impersonate/failed", request.url))
  }

  let upstream: Response
  try {
    upstream = await fetch(new URL("/v1/impersonation/claim", API_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Preserved so the session records where it was actually claimed from,
        // not the Next server's address.
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.redirect(new URL("/impersonate/failed", request.url))
  }

  if (!upstream.ok) {
    return NextResponse.redirect(new URL("/impersonate/failed", request.url))
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url))
  // getSetCookie() rather than get(): Set-Cookie is the one header that must
  // never be folded into a comma-joined string.
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie)
  }
  return response
}
