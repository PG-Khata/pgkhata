"use client"

import { useState } from "react"
import { toast } from "sonner"
import { IndianRupee, Plus, Trash2 } from "lucide-react"
import { useProperties } from "@/hooks/use-properties"
import { useTenants } from "@/hooks/use-tenants"
import { useBills } from "@/hooks/use-bills"
import { usePayments, useRecordPayment, useDeletePayment } from "@/hooks/use-payments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
import { Banknote, CalendarClock, CreditCard, FileText } from "lucide-react"

export default function PaymentsPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [recordOpen, setRecordOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; tenantName: string } | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    billId: "",
    amount: "",
    method: "cash",
    notes: "",
  })

  const activeProperty = propertyId || properties?.[0]?.id || ""
  const { data: payments, isLoading } = usePayments(activeProperty)
  const { data: tenants } = useTenants(activeProperty)
  const { data: bills } = useBills(activeProperty)
  const recordPayment = useRecordPayment(activeProperty)
  const deletePayment = useDeletePayment(activeProperty)

  const paymentsList = payments ?? []
  const totalCollected = paymentsList.reduce((sum, p) => sum + p.payment.amount, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthCollected = paymentsList
    .filter((p) => p.payment.paymentDate?.startsWith(thisMonth))
    .reduce((sum, p) => sum + p.payment.amount, 0)

  function handleRecord() {
    if (!paymentForm.billId || !paymentForm.amount) return
    recordPayment.mutate(
      {
        billId: paymentForm.billId,
        amount: Number(paymentForm.amount),
        paymentDate: new Date().toISOString(),
        method: paymentForm.method,
        notes: paymentForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Payment recorded")
          setRecordOpen(false)
          setPaymentForm({ billId: "", amount: "", method: "cash", notes: "" })
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to record payment"),
      },
    )
  }

  function handleDelete() {
    if (!deleteConfirm) return
    deletePayment.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("Payment deleted")
        setDeleteConfirm(null)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to delete payment"),
    })
  }

  // Get unpaid bills for the record payment dialog
  const unpaidBills = (bills ?? []).filter((b) => b.balance > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Payments</h1>
          <p className="text-xs text-muted-foreground">
            Payment ledger — all recorded payments across tenants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {properties && properties.length > 1 && (
            <select
              value={activeProperty}
              onChange={(event) => setPropertyId(event.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" onClick={() => setRecordOpen(true)} disabled={!activeProperty}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total payments" value={paymentsList.length} icon={FileText} />
        <StatCard label="Total collected" value={formatCurrency(totalCollected)} icon={CreditCard} />
        <StatCard label="This month" value={formatCurrency(thisMonthCollected)} icon={Banknote} />
        <StatCard
          label="Last payment"
          value={paymentsList.length > 0 ? formatDateShort(paymentsList[0].payment.paymentDate) : "—"}
          icon={CalendarClock}
        />
      </div>

      {propertiesLoading || isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : !activeProperty ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <IndianRupee className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Select a property</p>
        </div>
      ) : paymentsList.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <IndianRupee className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No payments recorded</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Record a payment from the Billing page or click the button above.
          </p>
        </div>
      ) : (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">TENANT</th>
                  <th className="px-4 py-3 font-medium">BILL MONTH</th>
                  <th className="px-4 py-3 font-medium">DATE</th>
                  <th className="px-4 py-3 font-medium">METHOD</th>
                  <th className="px-4 py-3 font-medium text-right">AMOUNT</th>
                  <th className="px-4 py-3 font-medium">NOTES</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {paymentsList.map(({ payment: p, tenantName, billMonth }) => (
                  <tr key={p.id} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{tenantName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{billMonth}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateShort(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {p.method || "cash"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{p.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteConfirm({ id: p.id, tenantName: tenantName || "Unknown" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {paymentsList.length} payment{paymentsList.length !== 1 ? "s" : ""}
              </span>
              <span className="font-mono">Total: {formatCurrency(totalCollected)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Record payment dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Record a payment against an outstanding bill.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Tenant & Bill <span className="text-destructive">*</span>
              </label>
              <select
                value={paymentForm.billId}
                onChange={(e) => setPaymentForm({ ...paymentForm, billId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a bill</option>
                {unpaidBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.tenantName} — {b.billMonth} (Balance: {formatCurrency(b.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Amount <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Method</label>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRecord}
              disabled={recordPayment.isPending || !paymentForm.billId || !paymentForm.amount}
            >
              {recordPayment.isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Delete payment"
        description={`Delete the payment for ${deleteConfirm?.tenantName}? This will recalculate the bill balance.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deletePayment.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
