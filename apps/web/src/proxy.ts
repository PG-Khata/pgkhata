import { NextResponse, type NextRequest } from "next/server"

const API_URL = process.env.API_URL || "http://localhost:3001"

/** Must match IMPERSONATION_COOKIE in apps/api/src/lib/impersonation.ts. */
const IMPERSONATION_COOKIE = "pgk_imp"

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  const cookie = request.headers.get("cookie")
  if (!cookie) return NextResponse.redirect(loginUrl)

  const forwardHeaders = {
    cookie,
    origin: request.nextUrl.origin,
    "x-forwarded-host": request.nextUrl.host,
    "x-forwarded-proto": request.nextUrl.protocol.replace(":", ""),
  }

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, "")}/api/auth/get-session`, {
      headers: forwardHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    })
    if (response.ok) {
      const session = (await response.json()) as { user?: unknown } | null
      if (session?.user) return NextResponse.next()
    }

    // A support session is authenticated by an impersonation grant, not by a
    // better-auth session — that separation is deliberate, and it is what keeps
    // /api/auth/* (password changes, sign-out) unreachable to an admin acting
    // as an owner. So the absence of a session here is not the absence of a
    // credential, and this second check is what makes impersonation reachable
    // at all.
    if (request.cookies.has(IMPERSONATION_COOKIE)) {
      const grant = await fetch(`${API_URL.replace(/\/$/, "")}/v1/impersonation/status`, {
        headers: forwardHeaders,
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      })
      if (grant.ok) {
        const status = (await grant.json()) as { active?: boolean }
        if (status.active) return NextResponse.next()
      }
    }
  } catch {
    return new NextResponse("Service temporarily unavailable", { status: 503 })
  }

  return NextResponse.redirect(loginUrl)
}

export const config = { matcher: ["/dashboard/:path*"] }
