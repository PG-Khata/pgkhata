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

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { data: properties = [], isLoading } = useProperties()
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === ALL_PROPERTIES_VALUE) {
      setSelectedId(null)
    } else if (stored) {
      setSelectedId(stored)
    } else {
      setSelectedId(null)
    }
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (initialized && !isLoading && properties.length > 0 && selectedId === null) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setSelectedId(properties[0].id)
        localStorage.setItem(STORAGE_KEY, properties[0].id)
      }
    }
  }, [initialized, isLoading, properties, selectedId])

  const selectedProperty = useMemo(
    () => (selectedId ? properties.find((p) => p.id === selectedId) ?? null : null),
    [properties, selectedId],
  )

  const setSelectedProperty = (property: Property | null) => {
    if (property) {
      setSelectedId(property.id)
      localStorage.setItem(STORAGE_KEY, property.id)
    } else {
      setSelectedId(null)
      localStorage.setItem(STORAGE_KEY, ALL_PROPERTIES_VALUE)
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
