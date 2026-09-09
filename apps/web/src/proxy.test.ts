import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "./proxy"

afterEach(() => vi.restoreAllMocks())

describe("dashboard server-side auth gate", () => {
  it("redirects a request without a session cookie before rendering", async () => {
    const response = await proxy(new NextRequest("https://app.example.com/dashboard/billing?month=1"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login?returnTo=%2Fdashboard%2Fbilling%3Fmonth%3D1")
  })

  it("allows a session verified by the API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ user: { id: "u1" } }))
    const response = await proxy(new NextRequest("https://app.example.com/dashboard", {
      headers: { cookie: "better-auth.session_token=token" },
    }))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("returns 503 instead of treating an auth outage as logged-out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("API down"))
    const response = await proxy(new NextRequest("https://app.example.com/dashboard", {
      headers: { cookie: "better-auth.session_token=token" },
    }))
    expect(response.status).toBe(503)
  })
})
