import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { AddPropertyModal } from "./add-property-modal"

function renderModal() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AddPropertyModal open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe("AddPropertyModal billing setup", () => {
  it("defaults to meter billing and requires a positive unit rate", async () => {
    const user = userEvent.setup()
    renderModal()

    const [rentCycle, electricityMode] = screen.getAllByRole("combobox") as HTMLSelectElement[]
    expect(rentCycle.value).toBe("calendar_month")
    expect(electricityMode.value).toBe("meter")
    expect(screen.getByText("Rate per unit (₹) *")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("NCR PG, Sector 59"), "Sunrise PG")
    await user.click(screen.getByRole("button", { name: "Create property" }))
    expect(await screen.findByText("Rate per unit is required")).toBeInTheDocument()
  })

  it("shows the per-tenant amount when fixed electricity is selected", async () => {
    const user = userEvent.setup()
    renderModal()
    const electricityMode = screen.getAllByRole("combobox")[1]!

    await user.selectOptions(electricityMode, "flat")
    expect(screen.getByText("Fixed amount per tenant/month (₹) *")).toBeInTheDocument()
    expect(screen.queryByText("Rate per unit (₹) *")).not.toBeInTheDocument()
  })
})
