import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BottomNav, MobileNavSheet, MobileNavTrigger } from "./mobile-nav"
import { MobileNavProvider } from "./mobile-nav-context"
import { NAV_GROUPS } from "./nav-config"

const pathname = vi.hoisted(() => ({ current: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}))

function renderShell() {
  return render(
    <MobileNavProvider>
      <MobileNavTrigger />
      <MobileNavSheet />
      <BottomNav />
    </MobileNavProvider>,
  )
}

describe("mobile navigation", () => {
  beforeEach(() => {
    pathname.current = "/dashboard"
  })

  it("opens the navigation menu from the More button", async () => {
    // Regression: More called document.querySelector("[data-mobile-menu-trigger]"),
    // which matched nothing, so the button was inert and every section outside
    // the four bottom slots was unreachable on a phone.
    const user = userEvent.setup()
    renderShell()

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "More navigation" }))

    const dialog = await screen.findByRole("dialog")
    // Scoped to the dialog: "Money" is also a bottom-bar label.
    expect(within(dialog).getByText("Operations")).toBeInTheDocument()
    expect(within(dialog).getByText("Money")).toBeInTheDocument()
    expect(within(dialog).getByText("Setup")).toBeInTheDocument()
  })

  it("opens the same menu from the header trigger", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("exposes every shipped section as a link once the menu is open", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole("button", { name: "More navigation" }))
    const dialog = await screen.findByRole("dialog")

    const shipped = NAV_GROUPS.flatMap((group) => group.items).filter(
      (item) => !item.upcoming,
    )

    for (const item of shipped) {
      const link = within(dialog).getByRole("link", { name: item.label })
      expect(link).toHaveAttribute("href", item.href)
    }
  })

  it("marks unshipped sections as disabled rather than linking to a 404", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole("button", { name: "More navigation" }))
    const dialog = await screen.findByRole("dialog")

    expect(within(dialog).queryByRole("link", { name: "Expenses" })).toBeNull()
    expect(within(dialog).getByText("Expenses").closest("[aria-disabled]")).toBeTruthy()
  })

  it("marks only the current section in the bottom bar", () => {
    pathname.current = "/dashboard/tenants"
    renderShell()

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute("href", "/dashboard/tenants")
  })
})
