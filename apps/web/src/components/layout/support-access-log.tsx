"use client"

import { useImpersonationStatus, useSupportHistory } from "@/hooks/use-impersonation"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, Pencil, ShieldCheck } from "lucide-react"

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/**
 * The owner's own record of every time PGKhata support entered their account.
 *
 * This is the transparency half of the deal: read-only support visits are
 * deliberately silent by email, so owners need somewhere they can always look.
 * Hidden during a support session, because it is the owner's record, not the
 * agent's.
 */
export function SupportAccessLog() {
  const { data: impersonation } = useImpersonationStatus()
  const isImpersonating = impersonation?.active === true
  const { data: visits, isLoading } = useSupportHistory(!isImpersonating)

  if (isImpersonating) return null

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Support access</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Every time PGKhata support has opened your account, and why.
      </p>

      {isLoading ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : !visits || visits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one from PGKhata has accessed your account.
        </p>
      ) : (
        <ul className="space-y-3">
          {visits.map((visit) => (
            <li key={visit.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                {visit.writeGrantedAt ? (
                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                    <Pencil className="h-3 w-3" />
                    Made changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    View only
                  </span>
                )}
                <span className="text-sm font-medium">{visit.adminName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(visit.startedAt)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{visit.reason}</p>
              {visit.writeReason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Changes made:</span>{" "}
                  {visit.writeReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
