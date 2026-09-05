"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useBeds } from "@/hooks/use-beds"
import { useTenants } from "@/hooks/use-tenants"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRightLeft,
  Bed,
  Download,
  LogOut,
  Pencil,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OnboardTenantModal } from "@/components/dashboard/onboard-tenant-modal"

export default function OccupancyPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""
  const qc = useQueryClient()

  const { data: beds, isLoading: bedsLoading } = useBeds(propertyId)
  const { data: tenants, isLoading: tenantsLoading } = useTenants(propertyId)

  const [search, setSearch] = useState("")
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState("")
  const [selectedBedId, setSelectedBedId] = useState("")
  const [allocating, setAllocating] = useState(false)
  const [checkoutTenant, setCheckoutTenant] = useState<{ id: string; name: string } | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const isLoading = bedsLoading || tenantsLoading

  const bedMap = new Map((beds ?? []).map((b) => [b.bed.id, b]))

  const activeTenants = (tenants ?? []).filter(
    (t) => t.status === "active" || t.status === "vacating",
  )

  const unassignedTenants = (tenants ?? []).filter(
    (t) => !t.bedId && t.status === "active",
  )
  const vacantBeds = (beds ?? []).filter((b) => b.bed.status === "vacant")

  const totalBeds = beds?.length ?? 0
  const occupied = beds?.filter((b) => b.bed.status === "occupied").length ?? 0
  const available = beds?.filter((b) => b.bed.status === "vacant").length ?? 0
  const maintenance = beds?.filter((b) => b.bed.status === "maintenance").length ?? 0
  const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0

  const filtered = activeTenants.filter((t) => {
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.phone.includes(search) ||
      (t.roomNumber ?? "").toLowerCase().includes(q) ||
      (t.bedNumber ?? "").toLowerCase().includes(q)
    )
  })

  function handleExport() {
    if (!filtered.length) {
      toast.error("No data to export")
      return
    }
    const header = "Tenant,Phone,Bed/Room,Check-in,Status"
    const rows = filtered.map((t) =>
      [t.name, t.phone, t.bedNumber ? `${t.roomNumber}-${t.bedNumber}` : "Unassigned", t.joiningDate.split("T")[0], t.status]
        .map((v) => `"${v}"`)
        .join(","),
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `occupancy-${selectedProperty?.name || "export"}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} records`)
  }

  function handleImport() {
    importRef.current?.click()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    toast.info(`Import from "${file.name}" is not yet implemented`)
    e.target.value = ""
  }

  async function handleAllocate() {
    if (!selectedTenantId || !selectedBedId) {
      toast.error("Select both a tenant and a bed")
      return
    }
    setAllocating(true)
    try {
      await api.post(
        `/v1/properties/${propertyId}/tenants/${selectedTenantId}/assign-bed`,
        { bedId: selectedBedId },
      )
      toast.success("Bed allocated")
      setSelectedTenantId("")
      setSelectedBedId("")
      setAllocateOpen(false)
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to allocate bed")
    } finally {
      setAllocating(false)
    }
  }

  async function handleCheckout() {
    if (!checkoutTenant) return
    setCheckingOut(true)
    try {
      await api.post(
        `/v1/properties/${propertyId}/tenants/${checkoutTenant.id}/vacate-bed`,
      )
      toast.success(`${checkoutTenant.name} checked out`)
      setCheckoutTenant(null)
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to check out")
    } finally {
      setCheckingOut(false)
    }
  }

  async function handleTransfer(tenantId: string, tenantName: string) {
    const bedId = prompt(`Transfer ${tenantName} to which vacant bed?\nEnter bed ID:`)
    if (!bedId) return
    try {
      await api.post(
        `/v1/properties/${propertyId}/tenants/${tenantId}/transfer`,
        { bedId },
      )
      toast.success(`${tenantName} transferred`)
      qc.invalidateQueries({ queryKey: ["beds", propertyId] })
      qc.invalidateQueries({ queryKey: ["tenants", propertyId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to transfer")
    }
  }

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Occupancy</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a property from the header to view occupancy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Occupancy</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Active bed allocations for this property.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="mr-1.5 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setAllocateOpen(true)}>
            <Bed className="mr-1.5 h-4 w-4" />
            Allocate
          </Button>
          <Button onClick={() => setOnboardOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Check-in
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total beds" value={totalBeds} icon={Bed} />
        <StatCard label="Occupied" value={occupied} icon={Users} />
        <StatCard label="Available" value={available} icon={Bed} />
        <StatCard label="Maintenance" value={maintenance} icon={Bed} />
        <StatCard label="Occupancy rate" value={`${occupancyRate}%`} icon={Users} />
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by tenant, bed, or room..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">TENANT</th>
                  <th className="px-4 py-3 font-medium">BED / ROOM</th>
                  <th className="px-4 py-3 font-medium">CHECK-IN</th>
                  <th className="px-4 py-3 font-medium">EXPECTED CHECKOUT</th>
                  <th className="px-4 py-3 font-medium">RENT</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const bedInfo = t.bedId ? bedMap.get(t.bedId) : null
                  const rent = bedInfo?.bed.monthlyRent ?? bedInfo?.roomRent ?? t.monthlyRentOverride ?? 0
                  return (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/properties/${propertyId}/tenants/${t.id}`}
                          className="font-medium hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.bedNumber
                          ? `Room ${t.roomNumber} · Bed ${t.bedNumber}`
                          : "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateShort(t.joiningDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.vacatingDate ? formatDateShort(t.vacatingDate) : "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {rent ? formatCurrency(rent) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status === "active" ? "active" : "vacating"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleTransfer(t.id, t.name)}
                          >
                            <ArrowRightLeft className="mr-1 h-3 w-3" />
                            Transfer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setCheckoutTenant({ id: t.id, name: t.name })}
                          >
                            <LogOut className="mr-1 h-3 w-3" />
                            Check out
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Due settings
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>Showing 1-{filtered.length} of {filtered.length}</span>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((t) => {
              const bedInfo = t.bedId ? bedMap.get(t.bedId) : null
              const rent = bedInfo?.bed.monthlyRent ?? bedInfo?.roomRent ?? t.monthlyRentOverride ?? 0
              return (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/properties/${propertyId}/tenants/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    <StatusBadge status={t.status === "active" ? "active" : "vacating"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Bed / Room</p>
                      <p>{t.bedNumber ? `Room ${t.roomNumber} · Bed ${t.bedNumber}` : "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rent</p>
                      <p className="font-mono">{rent ? formatCurrency(rent) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Check-in</p>
                      <p>{formatDateShort(t.joiningDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expected checkout</p>
                      <p>{t.vacatingDate ? formatDateShort(t.vacatingDate) : "-"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8"
                      onClick={() => handleTransfer(t.id, t.name)}
                    >
                      <ArrowRightLeft className="mr-1 h-3 w-3" />
                      Transfer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8"
                      onClick={() => setCheckoutTenant({ id: t.id, name: t.name })}
                    >
                      <LogOut className="mr-1 h-3 w-3" />
                      Check out
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Bed className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No active allocations</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Allocate a bed to a tenant to start their stay.
          </p>
        </div>
      )}

      {/* Hidden import input */}
      <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />

      {/* Onboard tenant modal */}
      <OnboardTenantModal open={onboardOpen} onOpenChange={setOnboardOpen} propertyId={propertyId} />

      {/* Allocate bed dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Allocate bed</DialogTitle>
            <DialogDescription>Assign an active tenant to a vacant bed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant</label>
              <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">Select tenant</option>
                {unassignedTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bed</label>
              <select value={selectedBedId} onChange={(e) => setSelectedBedId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">Select bed</option>
                {vacantBeds.map((b) => (
                  <option key={b.bed.id} value={b.bed.id}>{b.roomNumber}-{b.bed.number}{b.floorName ? ` (${b.floorName})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedTenantId(""); setSelectedBedId(""); setAllocateOpen(false) }}>Cancel</Button>
            <Button size="sm" onClick={handleAllocate} disabled={!selectedTenantId || !selectedBedId || allocating}>{allocating ? "Allocating..." : "Allocate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout confirmation dialog */}
      <Dialog open={!!checkoutTenant} onOpenChange={() => setCheckoutTenant(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check out tenant</DialogTitle>
            <DialogDescription>
              Release {checkoutTenant?.name}'s bed. The tenant will be marked as vacated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setCheckoutTenant(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? "Checking out..." : "Check out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
