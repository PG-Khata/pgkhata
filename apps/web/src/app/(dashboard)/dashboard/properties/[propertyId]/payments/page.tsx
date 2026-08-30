"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { usePayments, useRecordPayment, useDeletePayment } from "@/hooks/use-payments"
import { useBills } from "@/hooks/use-bills"
import { useProperty } from "@/hooks/use-properties"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function PaymentsPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: property } = useProperty(propertyId)
  const { data: payments, isLoading } = usePayments(propertyId)
  const { data: bills } = useBills(propertyId)
  const recordPayment = useRecordPayment(propertyId)
  const deletePayment = useDeletePayment(propertyId)

  const [form, setForm] = useState({
    billId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    method: "cash",
    notes: "",
  })

  function handleRecord() {
    if (!form.billId || !form.amount) {
      toast.error("Select a bill and enter amount")
      return
    }
    recordPayment.mutate(
      {
        billId: form.billId,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Payment recorded")
          setDialogOpen(false)
          setForm({ billId: "", amount: "", paymentDate: new Date().toISOString().split("T")[0], method: "cash", notes: "" })
        },
        onError: () => toast.error("Failed to record payment"),
      },
    )
  }

  function handleDelete(paymentId: string) {
    if (!confirm("Delete this payment? The bill will be recalculated.")) return
    deletePayment.mutate(paymentId, {
      onSuccess: () => toast.success("Payment deleted"),
      onError: () => toast.error("Failed to delete payment"),
    })
  }

  // Filter bills that have balance > 0
  const unpaidBills = bills?.filter((b) => b.bill.balance > 0) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/properties/${propertyId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Payments</h1>
            {property && (
              <p className="text-xs text-muted-foreground">{property.name}</p>
            )}
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record payment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bill *</label>
                <select
                  value={form.billId}
                  onChange={(e) => setForm({ ...form, billId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select a bill</option>
                  {unpaidBills.map((b) => (
                    <option key={b.bill.id} value={b.bill.id}>
                      {b.tenantName} — {b.bill.billMonth} (Balance: {formatCurrency(b.bill.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (₹) *</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="5000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Method</label>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <Button onClick={handleRecord} disabled={recordPayment.isPending} className="w-full">
                {recordPayment.isPending ? "Recording..." : "Record payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : payments && payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Tenant</th>
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 font-medium">{p.tenantName}</td>
                  <td className="py-2.5 text-muted-foreground">{p.billMonth}</td>
                  <td className="py-2.5 text-right font-mono font-medium">
                    {formatCurrency(p.payment.amount)}
                  </td>
                  <td className="py-2.5 text-muted-foreground capitalize">
                    {p.payment.method?.replace("_", " ") || "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{formatDate(p.payment.paymentDate)}</td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(p.payment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        </div>
      )}
    </div>
  )
}
