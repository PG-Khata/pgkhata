"use client"

import Link from "next/link"
import { useProperties } from "@/hooks/use-properties"
import {
  useTenants,
  useApproveTenant,
  useRejectTenant,
  useGenerateOnboardingLink,
} from "@/hooks/use-tenants"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPhone, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { Check, X, Link2 } from "lucide-react"
import { ApiError } from "@/lib/api-client"

export default function TenantsPage() {
  const { data: properties, isLoading: propsLoading } = useProperties()

  // Show tenants for the first property by default
  // In a real app, you'd have a global tenants endpoint
  const firstPropertyId = properties?.[0]?.id || ""
  const { data: tenants, isLoading: tenantsLoading } = useTenants(firstPropertyId)
  const approveTenant = useApproveTenant(firstPropertyId)
  const rejectTenant = useRejectTenant(firstPropertyId)
  const generateLink = useGenerateOnboardingLink(firstPropertyId)

  const isLoading = propsLoading || tenantsLoading

  // Pending-first: a tenant awaiting a decision needs the owner's attention,
  // so they lead the list; everything else follows, most recently joined first.
  const sorted = tenants
    ? [...tenants].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (a.status !== "pending" && b.status === "pending") return 1
        return new Date(b.joiningDate).getTime() - new Date(a.joiningDate).getTime()
      })
    : []

  function handleApprove(id: string, name: string) {
    approveTenant.mutate(id, {
      onSuccess: () => toast.success(`${name} approved`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to approve tenant"),
    })
  }

  function handleReject(id: string, name: string) {
    if (!confirm(`Reject ${name}'s signup? This cannot be undone.`)) return
    rejectTenant.mutate(id, {
      onSuccess: () => toast.success(`${name} rejected`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to reject tenant"),
    })
  }

  function handleCopyLink(id: string) {
    generateLink.mutate(id, {
      onSuccess: (data) => {
        const url = `${window.location.origin}/public/onboarding/${data.onboardingToken}`
        navigator.clipboard?.writeText(url)
        toast.success("Onboarding link copied to clipboard")
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : "Failed to generate onboarding link",
        ),
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tenants</h1>

      {properties && properties.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Showing tenants for {properties[0]?.name}. Select a property to see its tenants.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5">
                    <Link
                      href={`/dashboard/properties/${t.propertyId}/tenants/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2.5 font-mono text-muted-foreground">
                    {formatPhone(t.phone)}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {formatDateShort(t.joiningDate)}
                  </td>
                  <td className="py-2.5 text-right">
                    {t.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Approve"
                          className="h-7 w-7 text-muted-foreground hover:text-emerald-700"
                          onClick={() => handleApprove(t.id, t.name)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reject"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleReject(t.id, t.name)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : t.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleCopyLink(t.id)}
                      >
                        <Link2 className="mr-1 h-3 w-3" />
                        Onboarding link
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
          <Link
            href="/dashboard/properties"
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Go to a property to add tenants
          </Link>
        </div>
      )}
    </div>
  )
}
