import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useRecordPayment } from "./use-payments"

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test"
  return { fetch: vi.fn() }
})

describe("useRecordPayment", () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    vi.stubGlobal("fetch", mocks.fetch)
  })

  it("reuses one UUID until every concurrent duplicate has settled", async () => {
    const resolvers: Array<(value: Response) => void> = []
    mocks.fetch.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRecordPayment("property-id"), { wrapper })
    const input = {
      billId: "5ab53c4a-6096-4f36-a717-3df63218f57e",
      amount: 500,
      paymentDate: "2026-09-08",
      method: "cash",
    }

    let first!: Promise<unknown>
    let second!: Promise<unknown>
    await act(async () => {
      first = result.current.mutateAsync({ ...input })
      second = result.current.mutateAsync({ ...input })
      await Promise.resolve()
    })

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(String(mocks.fetch.mock.calls[0]![1]?.body))
    const secondBody = JSON.parse(String(mocks.fetch.mock.calls[1]![1]?.body))
    expect(firstBody.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey)

    resolvers[0]!(new Response(JSON.stringify({ id: "payment-id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    await act(async () => { await first })

    let third!: Promise<unknown>
    await act(async () => {
      third = result.current.mutateAsync({ ...input })
      await Promise.resolve()
    })
    const thirdBody = JSON.parse(String(mocks.fetch.mock.calls[2]![1]?.body))
    expect(thirdBody.idempotencyKey).toBe(firstBody.idempotencyKey)

    for (const resolve of resolvers.slice(1)) {
      resolve(new Response(JSON.stringify({ id: "payment-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    }
    await act(async () => { await Promise.all([second, third]) })
  })
})
