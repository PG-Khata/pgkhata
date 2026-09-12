"use client"

import { Building2, Check, ChevronDown } from "lucide-react"
import { useSelectedProperty } from "./property-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * PG scope selector. Switching re-scopes the current page in place — the
 * dropdown is a pure filter, not a navigator. `onSelect` lets a container (the
 * mobile nav sheet) close itself after a choice.
 */
export function PropertySelector({ onSelect }: { onSelect?: () => void }) {
  const { selectedProperty, setSelectedProperty, properties } = useSelectedProperty()

  if (properties.length === 0) return null

  function handlePropertyChange(property: (typeof properties)[number]) {
    onSelect?.()
    if (property.id === selectedProperty?.id) return
    setSelectedProperty(property)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent w-full sm:w-auto">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {selectedProperty?.name ?? "Select PG"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your properties</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {properties.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => handlePropertyChange(p)}
            className={p.id === selectedProperty?.id ? "bg-accent" : ""}
          >
            {p.id === selectedProperty?.id && (
              <Check className="mr-2 h-4 w-4" />
            )}
            <span className={p.id === selectedProperty?.id ? "" : "ml-6"}>
              {p.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
