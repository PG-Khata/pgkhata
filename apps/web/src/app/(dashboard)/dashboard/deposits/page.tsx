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
  useSecurityDeposits,
  useDepositLiabilityReport,
  useCreateSecurityDeposit,
  useRefundSecurityDeposit,
} from "@/hooks/use-security-deposits"
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

const createSchema = z.object({
  tenantId: z.string().min(1, "Select a tenant"),
  amount: z.preprocess((v) => Number(v), z.number().min(1, "Amount must be positive")),
  notes: z.string().optional(),
})
type CreateFormData = z.infer<typeof createSchema>

const refundSchema = z.object({
  amount: z.preprocess((v) => Number(v), z.number().min(1, "Amount must be positive")),
})
type RefundFormData = z.infer<typeof refundSchema>

export default function SecurityDepositsPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [refundTarget, setRefundTarget] = useState<{
    id: string
    tenantName: string
    outstanding: number
  } | null>(null)

  const activeProperty = propertyId || properties?.[0]?.id || ""
  const { data: deposits, isLoading } = useSecurityDeposits(activeProperty)
  const { data: report } = useDepositLiabilityReport(activeProperty)
  const { data: tenants } = useTenants(activeProperty)
  const createDeposit = useCreateSecurityDeposit(activeProperty)
  const refundDeposit = useRefundSecurityDeposit(activeProperty)

  const createForm = useForm<CreateFormData>({ resolver: zodResolver(createSchema) as never })
  const refundForm = useForm<RefundFormData>({ resolver: zodResolver(refundSchema) as never })

  function onCreate(data: CreateFormData) {
    createDeposit.mutate(data, {
      onSuccess: () => {
        toast.success("Deposit recorded")
        createForm.reset()
        setAddOpen(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to record deposit"),
    })
  }

  function onRefund(data: RefundFormData) {
    if (!refundTarget) return
    refundDeposit.mutate(
      { depositId: refundTarget.id, amount: data.amount },
      {
        onSuccess: () => {
          toast.success("Refund issued")
          refundForm.reset()
          setRefundTarget(null)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to issue refund"),
      },
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Security deposits</h1>
          <p className="text-xs text-muted-foreground">
            Money held for tenants, refunded partially or in full when they leave.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!activeProperty}>
          <Plus className="mr-1.5 h-4 w-4" />
          Deposit
        </Button>
      </div>

      {report && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total held</p>
            <p className="font-mono text-lg font-semibold">{formatCurrency(report.totalHeld)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total refunded</p>
            <p className="font-mono text-lg font-semibold">
              {formatCurrency(report.totalRefunded)}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Net liability</p>
            <p className="font-mono text-lg font-semibold">
              {formatCurrency(report.netLiability)}
            </p>
          </div>
        </div>
      )}

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
      ) : !deposits || deposits.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No security deposits yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Tenant</th>
                  <th className="pb-2 text-right font-medium">Held</th>
                  <th className="pb-2 text-right font-medium">Refunded</th>
                  <th className="pb-2 text-right font-medium">Outstanding</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {deposits.map(({ deposit, tenantName }) => {
                  const outstanding = deposit.amount - deposit.refundAmount
                  return (
                    <tr key={deposit.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-medium">{tenantName}</td>
                      <td className="py-2.5 text-right font-mono">
                        {formatCurrency(deposit.amount)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">
                        {formatCurrency(deposit.refundAmount)}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={deposit.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        {outstanding > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setRefundTarget({ id: deposit.id, tenantName, outstanding })
                            }
                          >
                            Refund
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {deposits.map(({ deposit, tenantName }) => {
              const outstanding = deposit.amount - deposit.refundAmount
              return (
                <div key={deposit.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tenantName}</span>
                    <StatusBadge status={deposit.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Held</p>
                      <p className="font-mono">{formatCurrency(deposit.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refunded</p>
                      <p className="font-mono text-muted-foreground">{formatCurrency(deposit.refundAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="font-mono">{formatCurrency(outstanding)}</p>
                    </div>
                  </div>
                  {outstanding > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9"
                      onClick={() =>
                        setRefundTarget({ id: deposit.id, tenantName, outstanding })
                      }
                    >
                      Refund
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record deposit</DialogTitle>
            <DialogDescription>
              Money held for a tenant, refunded partially or in full later.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant *</label>
              <select
                {...createForm.register("tenantId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a tenant</option>
                {tenants?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {createForm.formState.errors.tenantId && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.tenantId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹) *</label>
              <Input type="number" placeholder="10000" {...createForm.register("amount")} />
              {createForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Optional" {...createForm.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createDeposit.isPending}>
                Record deposit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Issue refund</DialogTitle>
            <DialogDescription>
              {refundTarget &&
                `${refundTarget.tenantName} has ${formatCurrency(refundTarget.outstanding)} outstanding. Enter the amount to refund now — partial refunds are allowed.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={refundForm.handleSubmit(onRefund)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹) *</label>
              <Input
                type="number"
                placeholder={refundTarget ? String(refundTarget.outstanding) : ""}
                {...refundForm.register("amount")}
              />
              {refundForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {refundForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefundTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={refundDeposit.isPending}>
                Issue refund
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
