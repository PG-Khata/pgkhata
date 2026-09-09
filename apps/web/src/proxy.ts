import { NextResponse, type NextRequest } from "next/server"

const API_URL = process.env.API_URL || "http://localhost:3001"

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  if (!request.headers.get("cookie")) return NextResponse.redirect(loginUrl)

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, "")}/api/auth/get-session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        origin: request.nextUrl.origin,
        "x-forwarded-host": request.nextUrl.host,
        "x-forwarded-proto": request.nextUrl.protocol.replace(":", ""),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    })
    if (response.ok) {
      const session = await response.json() as { user?: unknown } | null
      if (session?.user) return NextResponse.next()
    }
  } catch {
    return new NextResponse("Service temporarily unavailable", { status: 503 })
  }

  return NextResponse.redirect(loginUrl)
}

export const config = { matcher: ["/dashboard/:path*"] }
