"use client"

import { createContext, useContext, useMemo, useState, useEffect } from "react"
import { useProperties } from "@/hooks/use-properties"
import type { Property } from "@/types"

interface PropertyContextState {
  /** The one PG the whole app is scoped to. Null only while an owner has none. */
  selectedProperty: Property | null
  setSelectedProperty: (property: Property) => void
  /** Select by id when only the id is known (e.g. a redirect from a URL). */
  selectPropertyById: (id: string) => void
  properties: Property[]
  isLoading: boolean
}

const PropertyContext = createContext<PropertyContextState | null>(null)

const STORAGE_KEY = "pgkhata-selected-property"

function readStoredSelection(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeSelection(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Selection remains usable in memory when storage is unavailable.
  }
}

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { data: properties = [], isLoading } = useProperties()
  const [selectedId, setSelectedId] = useState<string | undefined>(readStoredSelection)

  // Persist the implicit default (first property) once the list has loaded, so a
  // later visit reopens on the same PG. State stays undefined; the derivation
  // below resolves the default at runtime.
  useEffect(() => {
    if (!isLoading && properties.length > 0 && selectedId === undefined) {
      storeSelection(properties[0].id)
    }
  }, [isLoading, properties, selectedId])

  // Self-heal a stale stored id (e.g. a deleted PG): the derivation below already
  // falls back to the first property, so rewrite storage to match it and the
  // fallback persists across reloads.
  useEffect(() => {
    if (
      !isLoading &&
      selectedId &&
      properties.length > 0 &&
      !properties.some((p) => p.id === selectedId)
    ) {
      storeSelection(properties[0].id)
    }
  }, [isLoading, properties, selectedId])

  // Exactly one PG is selected whenever the owner has any. A stored id that no
  // longer exists (deleted PG) falls back to the first property.
  const selectedProperty = useMemo(() => {
    if (properties.length === 0) return null
    if (selectedId) {
      return properties.find((p) => p.id === selectedId) ?? properties[0]
    }
    return properties[0]
  }, [properties, selectedId])

  const setSelectedProperty = (property: Property) => {
    setSelectedId(property.id)
    storeSelection(property.id)
  }

  const selectPropertyById = (id: string) => {
    setSelectedId(id)
    storeSelection(id)
  }

  const value = useMemo(
    () => ({
      selectedProperty,
      setSelectedProperty,
      selectPropertyById,
      properties,
      isLoading,
    }),
    [selectedProperty, properties, isLoading],
  )

  return (
    <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
  )
}

export function useSelectedProperty(): PropertyContextState {
  const context = useContext(PropertyContext)
  if (!context) {
    throw new Error("useSelectedProperty must be used within a PropertyProvider")
  }
  return context
}
