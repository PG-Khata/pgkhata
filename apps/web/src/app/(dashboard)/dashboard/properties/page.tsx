"use client"

import { useState } from "react"
import Link from "next/link"
import { useProperties } from "@/hooks/use-properties"
import { useOwnerDashboard } from "@/hooks/use-dashboard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { AddPropertyModal } from "@/components/dashboard/add-property-modal"
import {
  Bed,
  Building2,
  MapPin,
  Pencil,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react"

export default function PropertiesPage() {
  const { data: properties, isLoading } = useProperties()
  const { data: dashboard } = useOwnerDashboard()
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const filteredProperties = properties?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase()),
  )

  const cities = properties
    ? [...new Set(properties.map((p) => p.city).filter(Boolean))].length
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Properties</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All PG / hostel properties you own or manage.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add property
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Properties"
          value={properties?.length ?? 0}
          icon={Building2}
        />
        <StatCard
          label="Cities"
          value={cities}
          icon={MapPin}
        />
        <StatCard
          label="Total beds"
          value={dashboard?.totalBeds ?? 0}
          icon={Bed}
        />
        <StatCard
          label="Occupied beds"
          value={dashboard?.occupiedBeds ?? 0}
          icon={Bed}
        />
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredProperties && filteredProperties.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Total beds</th>
                <th className="px-4 py-3 font-medium">Occupied</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.signupToken && (
                      <p className="text-xs text-muted-foreground">
                        {p.signupToken}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {p.city || p.address || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {p.totalBeds ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Bed className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-muted-foreground">
                        {p.occupiedBeds ?? 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/properties/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-8">
                          Open
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/properties/${p.id}/edit`}>
                        <Button variant="ghost" size="sm" className="h-8">
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing 1-{filteredProperties.length} of {filteredProperties.length}
            </span>
          </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No properties yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first property to start managing tenants
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add property
          </button>
        </div>
      )}

      <AddPropertyModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
