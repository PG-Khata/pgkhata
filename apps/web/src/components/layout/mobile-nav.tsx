"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Ellipsis, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useMobileNav } from "./mobile-nav-context"
import {
  BOTTOM_NAV_ITEMS,
  NAV_GROUPS,
  isNavItemActive,
  type NavItem,
} from "./nav-config"

/** 44px minimum touch target, per the mobile-first constraint. */
const TOUCH_TARGET = "min-h-11 min-w-11"

export function MobileNavTrigger() {
  const { setOpen } = useMobileNav()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open navigation menu"
      className={cn(TOUCH_TARGET, "md:hidden")}
      onClick={() => setOpen(true)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

/**
 * Rendered once by the dashboard layout, not nested inside a trigger button —
 * the previous version put the whole Sheet inside a <Button>, which is invalid
 * nesting for a dialog.
 */
export function MobileNavSheet() {
  const { open, setOpen } = useMobileNav()
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="text-base font-semibold">pgkhata</SheetTitle>
        </SheetHeader>
        <nav className="overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {NAV_GROUPS.map((group, index) => (
            <div
              key={group.label ?? "root"}
              className={cn(index > 0 && "mt-4 border-t pt-4")}
            >
              {group.label ? (
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) =>
                  item.upcoming ? (
                    <span
                      key={item.href}
                      aria-disabled="true"
                      className={cn(
                        TOUCH_TARGET,
                        "flex cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/50",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-wide">Soon</span>
                    </span>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={
                        isNavItemActive(pathname, item.href) ? "page" : undefined
                      }
                      className={cn(
                        TOUCH_TARGET,
                        "flex items-center gap-3 rounded-md px-3 text-sm transition-colors",
                        isNavItemActive(pathname, item.href)
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function BottomNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(pathname, item.href)
  const shared = cn(
    TOUCH_TARGET,
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
  )

  if (item.upcoming) {
    return (
      <span aria-disabled="true" className={cn(shared, "text-muted-foreground/40")}>
        <item.icon className="h-5 w-5" />
        {item.label}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(shared, active ? "text-foreground" : "text-muted-foreground")}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const { setOpen } = useMobileNav()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-14 items-stretch">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <BottomNavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <button
          type="button"
          aria-label="More navigation"
          onClick={() => setOpen(true)}
          className={cn(
            TOUCH_TARGET,
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground",
          )}
        >
          <Ellipsis className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  )
}
