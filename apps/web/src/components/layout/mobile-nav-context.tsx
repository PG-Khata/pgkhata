"use client"

import { createContext, useContext, useMemo, useState } from "react"

interface MobileNavState {
  open: boolean
  setOpen: (open: boolean) => void
}

const MobileNavContext = createContext<MobileNavState | null>(null)

/**
 * The header hamburger and the bottom bar's More button open the same menu.
 * Previously each rendered its own trigger and More reached for the other with
 * `document.querySelector("[data-mobile-menu-trigger]")`, which matched no
 * element — so More did nothing and half the navigation was unreachable on a
 * phone. Sharing state removes the DOM lookup entirely.
 */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])

  return (
    <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
  )
}

export function useMobileNav(): MobileNavState {
  const context = useContext(MobileNavContext)
  if (!context) {
    throw new Error("useMobileNav must be used within a MobileNavProvider")
  }
  return context
}
