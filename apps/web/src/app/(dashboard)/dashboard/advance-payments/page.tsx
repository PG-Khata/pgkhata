"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { useProperties } from "@/hooks/use-properties"
import { useTenants } from "@/hooks/use-tenants"
import {
  useAdvancePayments,
  useCreateAdvancePayment,
  useForfeitAdvancePayment,
} from "@/hooks/use-advance-payments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/dashboard/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { ApiError } from "@/lib/api-client"

const schema = z.object({
  tenantId: z.string().min(1, "Select a tenant"),
  amount: z.preprocess((v) => Number(v), z.number().min(1, "Amount must be positive")),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function AdvancePaymentsPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const activeProperty = propertyId || properties?.[0]?.id || ""
  const { data: advances, isLoading } = useAdvancePayments(activeProperty)
  const { data: tenants } = useTenants(activeProperty)
  const createAdvance = useCreateAdvancePayment(activeProperty)
  const forfeitAdvance = useForfeitAdvancePayment(activeProperty)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) as never })

  function onSubmit(data: FormData) {
    createAdvance.mutate(data, {
      onSuccess: () => {
        toast.success("Advance recorded")
        reset()
        setDialogOpen(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to record advance"),
    })
  }

  function handleForfeit(id: string, tenantName: string) {
    if (!confirm(`Forfeit this advance for ${tenantName}? This cannot be undone.`)) return

    forfeitAdvance.mutate(id, {
      onSuccess: () => toast.success("Advance forfeited"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to forfeit advance"),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Advance payments</h1>
          <p className="text-xs text-muted-foreground">
            Money held for a tenant, applied against a bill later or forfeited.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!activeProperty}>
          <Plus className="mr-1.5 h-4 w-4" />
          Advance
        </Button>
      </div>

      {propertiesLoading || isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !activeProperty ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Add a property first.</p>
        </div>
      ) : !advances || advances.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No advance payments yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Tenant</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Applied</th>
                  <th className="pb-2 text-right font-medium">Available</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {advances.map(({ advance, tenantName }) => (
                  <tr key={advance.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 font-medium">{tenantName}</td>
                    <td className="py-2.5 text-muted-foreground">{formatDateShort(advance.date)}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(advance.amount)}</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">
                      {formatCurrency(advance.appliedAmount)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCurrency(advance.amount - advance.appliedAmount)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={advance.status} />
                    </td>
                    <td className="py-2.5 text-right">
                      {advance.status === "available" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => handleForfeit(advance.id, tenantName)}
                        >
                          Forfeit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {advances.map(({ advance, tenantName }) => (
              <div key={advance.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tenantName}</span>
                  <StatusBadge status={advance.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-mono">{formatCurrency(advance.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Applied</p>
                    <p className="font-mono text-muted-foreground">{formatCurrency(advance.appliedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-mono">{formatCurrency(advance.amount - advance.appliedAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateShort(advance.date)}</span>
                  {advance.status === "available" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleForfeit(advance.id, tenantName)}
                    >
                      Forfeit
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record advance</DialogTitle>
            <DialogDescription>
              Apply it to a bill later from the tenant's page, or forfeit it if it
              is not returned.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant *</label>
              <select
                {...register("tenantId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a tenant</option>
                {tenants?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors.tenantId && (
                <p className="text-xs text-destructive">{errors.tenantId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹) *</label>
              <Input type="number" placeholder="5000" {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Optional" {...register("notes")} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createAdvance.isPending}>
                Record advance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
