import { describe, expect, it } from "vitest"
import {
  BOTTOM_NAV_ITEMS,
  NAV_GROUPS,
  NAV_ITEMS,
  isNavItemActive,
} from "./nav-config"

describe("isNavItemActive", () => {
  it("matches a route exactly", () => {
    expect(isNavItemActive("/dashboard/properties", "/dashboard/properties")).toBe(true)
  })

  it("does not light up Dashboard on every page", () => {
    // The previous implementation used startsWith(href + "/"), so every route
    // under /dashboard/ marked the Dashboard entry active.
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true)
    expect(isNavItemActive("/dashboard/properties", "/dashboard")).toBe(false)
    expect(isNavItemActive("/dashboard/billing", "/dashboard")).toBe(false)
  })

  it("stays active on descendant routes", () => {
    expect(
      isNavItemActive("/dashboard/properties/abc123/rooms", "/dashboard/properties"),
    ).toBe(true)
    expect(
      isNavItemActive("/dashboard/properties/abc123/rooms/new", "/dashboard/properties"),
    ).toBe(true)
  })

  it("attributes property-scoped pages to the section that owns them", () => {
    const path = "/dashboard/properties/abc123/tenants"
    expect(isNavItemActive(path, "/dashboard/properties")).toBe(true)
    expect(isNavItemActive(path, "/dashboard/tenants")).toBe(false)
  })

  it("requires a path separator, so sibling prefixes do not collide", () => {
    expect(isNavItemActive("/dashboard/rent-plans", "/dashboard/rent")).toBe(false)
    expect(isNavItemActive("/dashboard/payments-archive", "/dashboard/payments")).toBe(
      false,
    )
  })

  it("marks exactly one group item active for any dashboard route", () => {
    const routes = [
      "/dashboard",
      "/dashboard/properties",
      "/dashboard/properties/abc/rooms",
      "/dashboard/tenants",
      "/dashboard/billing",
      "/dashboard/readings",
      "/dashboard/complaints",
      "/dashboard/settings",
    ]

    for (const route of routes) {
      const active = NAV_ITEMS.filter((item) => isNavItemActive(route, item.href))
      expect(active, `route ${route}`).toHaveLength(1)
    }
  })
})

describe("navigation configuration", () => {
  it("groups the information architecture as Operations, Money and Setup", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      undefined,
      "Operations",
      "Money",
      "Setup",
    ])
  })

  it("has no duplicate destinations", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("keeps the bottom bar to four items so More is the fifth slot", () => {
    expect(BOTTOM_NAV_ITEMS).toHaveLength(4)
  })

  it("makes every sidebar destination reachable from the mobile sheet", () => {
    // The mobile sheet renders NAV_GROUPS, the same source as the sidebar, so
    // a section can never exist on desktop only.
    const sheetHrefs = new Set(NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href))
    for (const item of NAV_ITEMS) {
      expect(sheetHrefs.has(item.href), `${item.label} unreachable on mobile`).toBe(true)
    }
  })

  it("routes every bottom-bar destination to a real sidebar section", () => {
    const known = new Set(NAV_ITEMS.map((item) => item.href))
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(known.has(item.href), `${item.label} is not a sidebar section`).toBe(true)
    }
  })
})
