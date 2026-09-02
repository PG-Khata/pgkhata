"use client"

import { useState } from "react"
import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useTenants } from "@/hooks/use-tenants"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { formatPhone } from "@/lib/utils"
import { toast } from "sonner"
import {
  Download,
  FileText,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
} from "lucide-react"
import { OnboardTenantModal } from "@/components/dashboard/onboard-tenant-modal"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function TenantsPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""

  const { data: tenants, isLoading } = useTenants(propertyId)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  function handleExport() {
    if (!filtered.length) {
      toast.error("No tenants to export")
      return
    }
    const header = "Name,Phone,Email,Occupation,Status,Bed,Joined"
    const rows = filtered.map((t) =>
      [
        t.name,
        t.phone,
        t.email || "",
        t.occupation || "",
        t.status,
        t.bedNumber ? `${t.roomNumber || ""}-${t.bedNumber}` : "Unassigned",
        t.joiningDate.split("T")[0],
      ]
        .map((v) => `"${v}"`)
        .join(","),
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tenants-${selectedProperty?.name || "export"}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} tenants`)
  }

  function handleImport() {
    setImportOpen(true)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    toast.info(`Import from "${file.name}" is not yet implemented`)
    e.target.value = ""
  }

  function handleQuickOnboard() {
    setOnboardOpen(true)
  }

  const sorted = tenants
    ? [...tenants].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (a.status !== "pending" && b.status === "pending") return 1
        return new Date(b.joiningDate).getTime() - new Date(a.joiningDate).getTime()
      })
    : []

  const filtered = sorted.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search)
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a property from the header to view tenants.
          </p>
        </div>
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No property selected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the property selector in the header to choose a property.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Residents onboarded at this property.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/tenants/report">
            <Button variant="outline" size="sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Report
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleQuickOnboard}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Quick Onboard
          </Button>
          <Button size="sm" onClick={() => setOnboardOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Onboard Tenant
          </Button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="vacating">Vacating</option>
          <option value="vacated">Vacated</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">TENANT</th>
                  <th className="px-4 py-3 font-medium">OCCUPATION</th>
                  <th className="px-4 py-3 font-medium">BED</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {getInitials(t.name)}
                        </div>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatPhone(t.phone)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.occupation || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.bedNumber
                        ? `${t.roomNumber || ""}-${t.bedNumber}`
                        : "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/properties/${t.propertyId}/tenants/${t.id}`}
                        className="inline-flex h-7 items-center rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing 1-{filtered.length} of {filtered.length}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No tenants yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Onboard your first tenant to get started.
          </p>
        </div>
      )}

      <OnboardTenantModal
        open={onboardOpen}
        onOpenChange={setOnboardOpen}
        propertyId={propertyId}
      />

      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        id="tenant-import-input"
        onChange={handleImportFile}
        ref={(el) => {
          if (el && importOpen) {
            el.click()
            setImportOpen(false)
          }
        }}
      />
    </div>
  )
}
