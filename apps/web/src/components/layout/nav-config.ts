import {
  Building2,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  TrendingDown,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /**
   * Section exists in the information architecture but its feature has not
   * shipped yet. Rendered disabled rather than linking to a 404.
   */
  upcoming?: boolean
}

export interface NavGroup {
  /** Undefined for the ungrouped top-level entry. */
  label?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { label: "Properties", href: "/dashboard/properties", icon: Building2 },
      { label: "Tenants", href: "/dashboard/tenants", icon: Users },
      { label: "Complaints", href: "/dashboard/complaints", icon: MessageSquare },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: Receipt },
      { label: "Payments", href: "/dashboard/payments", icon: IndianRupee, upcoming: true },
      { label: "Expenses", href: "/dashboard/expenses", icon: TrendingDown, upcoming: true },
      { label: "Deposits", href: "/dashboard/deposits", icon: PiggyBank, upcoming: true },
    ],
  },
  {
    label: "Setup",
    items: [
      { label: "Readings", href: "/dashboard/readings", icon: Zap },
      { label: "Rent plans", href: "/dashboard/rent-plans", icon: ClipboardList },
      { label: "Charge types", href: "/dashboard/charge-types", icon: Tags },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

/** Flat list of every navigable destination, in sidebar order. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/**
 * The four destinations an owner needs most on a phone. Everything else is
 * reachable through More, which opens the full grouped menu.
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tenants", href: "/dashboard/tenants", icon: Users },
  { label: "Billing", href: "/dashboard/billing", icon: Receipt },
  { label: "Money", href: "/dashboard/payments", icon: IndianRupee, upcoming: true },
]

/**
 * A nav item is active on its own route or on a descendant of it.
 *
 * `/dashboard` must match exactly: a `startsWith` prefix test lit up Dashboard
 * on every page in the app, because every route begins with `/dashboard/`.
 *
 * Descendant matching is `/`-delimited so `/dashboard/rent-plans` does not
 * activate a hypothetical `/dashboard/rent` entry, and property-scoped routes
 * such as `/dashboard/properties/<id>/tenants` keep highlighting Properties —
 * the section that owns them — rather than the top-level Tenants entry.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === "/dashboard") return false
  return pathname.startsWith(`${href}/`)
}
