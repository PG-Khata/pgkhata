import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { OnboardTenantModal } from "./onboard-tenant-modal"

function renderPublicSignup() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardTenantModal
        open
        onOpenChange={vi.fn()}
        propertyId="signup-token"
        isPublic
        rooms={[]}
      />
    </QueryClientProvider>,
  )
}

describe("OnboardTenantModal ID proof selection", () => {
  it("uses a directly clickable native input and allows the same file after removal", async () => {
    const user = userEvent.setup()
    renderPublicSignup()

    const input = screen.getByLabelText(/ID proof/i) as HTMLInputElement
    expect(input).not.toHaveClass("hidden")
    expect(input).toHaveClass("opacity-0")

    const file = new File(["test-image"], "aadhaar.jpg", { type: "image/jpeg" })
    await user.upload(input, file)
    expect(screen.getByText("aadhaar.jpg")).toBeInTheDocument()
    expect(input.value).toBe("")

    await user.click(screen.getByRole("button", { name: "Remove aadhaar.jpg" }))
    expect(screen.queryByText("aadhaar.jpg")).not.toBeInTheDocument()

    await user.upload(input, file)
    expect(screen.getByText("aadhaar.jpg")).toBeInTheDocument()
  })

  it("rejects file types that the API does not accept", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderPublicSignup()

    const input = screen.getByLabelText(/ID proof/i) as HTMLInputElement
    await user.upload(
      input,
      new File(["webp-image"], "aadhaar.webp", { type: "image/webp" }),
      { applyAccept: false },
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only JPG, PNG, and PDF documents are allowed",
    )
    expect(screen.queryByText("aadhaar.webp")).not.toBeInTheDocument()
  })

  it("rejects documents larger than the API's five-megabyte limit", async () => {
    const user = userEvent.setup()
    renderPublicSignup()

    const input = screen.getByLabelText(/ID proof/i) as HTMLInputElement
    const oversizedFile = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "large-aadhaar.jpg",
      { type: "image/jpeg" },
    )
    await user.upload(input, oversizedFile)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Each document must be 5 MB or smaller",
    )
    expect(screen.queryByText("large-aadhaar.jpg")).not.toBeInTheDocument()
  })
})
