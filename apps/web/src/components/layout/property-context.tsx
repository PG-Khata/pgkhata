"use client"

import { createContext, useContext, useMemo, useState, useEffect } from "react"
import { useProperties } from "@/hooks/use-properties"
import type { Property } from "@/types"

interface PropertyContextState {
  selectedProperty: Property | null
  setSelectedProperty: (property: Property | null) => void
  properties: Property[]
  isLoading: boolean
}

const PropertyContext = createContext<PropertyContextState | null>(null)

const STORAGE_KEY = "pgkhata-selected-property"
const ALL_PROPERTIES_VALUE = "__all__"

function readStoredSelection(): string | null | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === ALL_PROPERTIES_VALUE ? null : stored ?? undefined
  } catch {
    return undefined
  }
}

function storeSelection(value: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, value ?? ALL_PROPERTIES_VALUE)
  } catch {
    // Selection remains usable in memory when storage is unavailable.
  }
}

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { data: properties = [], isLoading } = useProperties()
  const [selectedId, setSelectedId] = useState<string | null | undefined>(readStoredSelection)

  useEffect(() => {
    if (!isLoading && properties.length > 0 && selectedId === undefined) {
      storeSelection(properties[0].id)
    }
  }, [isLoading, properties, selectedId])

  const selectedProperty = useMemo(
    () => selectedId === undefined
      ? properties[0] ?? null
      : selectedId
        ? properties.find((p) => p.id === selectedId) ?? null
        : null,
    [properties, selectedId],
  )

  const setSelectedProperty = (property: Property | null) => {
    if (property) {
      setSelectedId(property.id)
      storeSelection(property.id)
    } else {
      setSelectedId(null)
      storeSelection(null)
    }
  }

  const value = useMemo(
    () => ({ selectedProperty, setSelectedProperty, properties, isLoading }),
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
