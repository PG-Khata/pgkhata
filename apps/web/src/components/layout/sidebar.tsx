"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_GROUPS, isNavItemActive, type NavItem } from "./nav-config"

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(pathname, item.href)

  if (item.upcoming) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/40"
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        active
          ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <item.icon className={cn("h-4 w-4", active && "text-primary")} />
      {item.label}
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          pgkhata
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, index) => (
          <div
            key={group.label ?? "root"}
            className={cn(index > 0 && "mt-6")}
          >
            {group.label ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
