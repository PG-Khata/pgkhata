"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useProperties } from "@/hooks/use-properties"
import { useTenants } from "@/hooks/use-tenants"
import { useBills, useGenerateBills, useApplyLateFees, useDeleteBill, useSetPromisedDate } from "@/hooks/use-bills"
import { useRecordPayment } from "@/hooks/use-payments"
import { useSecurityDeposits, useCreateSecurityDeposit } from "@/hooks/use-security-deposits"
import { useAdvancePayments, useCreateAdvancePayment } from "@/hooks/use-advance-payments"
import { useDueRent } from "@/hooks/use-dashboard"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { InvoiceTemplate } from "@/components/dashboard/invoice-template"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Minus,
  PiggyBank,
  Plus,
  Receipt,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getLast12Months() {
  const months: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    months.push({ value, label })
  }
  return months
}

export default function BillingPage() {
  const { selectedProperty, setSelectedProperty } = useSelectedProperty()
  const { data: properties, isLoading: propsLoading } = useProperties()

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Billing</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Select a property to manage billing.</p>
        </div>
        {propsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : properties && properties.length > 0 ? (
          <div className="space-y-2">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProperty(p)}
                className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">View bills</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No properties</p>
          </div>
        )}
      </div>
    )
  }

  return <BillingContent propertyId={selectedProperty.id} propertyName={selectedProperty.name} />
}

function BillingContent({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState(currentMonth())
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(currentMonth())
  const [generateTenantId, setGenerateTenantId] = useState("")
  const [paymentOpen, setPaymentOpen] = useState<{ billId: string; tenantName: string; balance: number } | null>(null)
  const [promiseOpen, setPromiseOpen] = useState<{ billId: string; tenantName: string } | null>(null)
  const [voidConfirm, setVoidConfirm] = useState<{ billId: string; tenantName: string } | null>(null)
  const [viewInvoice, setViewInvoice] = useState<any>(null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [depositForm, setDepositForm] = useState({ tenantId: "", amount: "", notes: "" })
  const [advanceForm, setAdvanceForm] = useState({ tenantId: "", amount: "", notes: "" })
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", notes: "" })
  const [promiseDate, setPromiseDate] = useState("")

  const { data: bills, isLoading, error: billsError } = useBills(propertyId, monthFilter)
  const generateBills = useGenerateBills(propertyId)
  const applyLateFees = useApplyLateFees(propertyId)
  const voidBill = useDeleteBill(propertyId)
  const setPromisedDate = useSetPromisedDate(propertyId)
  const recordPayment = useRecordPayment(propertyId)
  const { data: deposits } = useSecurityDeposits(propertyId)
  const createDeposit = useCreateSecurityDeposit(propertyId)
  const { data: advances } = useAdvancePayments(propertyId)
  const createAdvance = useCreateAdvancePayment(propertyId)
  const { data: dueRent } = useDueRent(propertyId)
  const { data: tenants } = useTenants(propertyId)

  const activeBills = bills ?? []
  const filtered = activeBills.filter((b: any) => statusFilter === "all" || b.status === statusFilter)

  const totalInvoices = activeBills.length
  const pending = activeBills.filter((b: any) => b.status === "pending").length
  const partial = activeBills.filter((b: any) => b.status === "partial").length
  const overdue = activeBills.filter((b: any) => b.status === "overdue").length
  const collectedThisMonth = activeBills.reduce((s: number, b: any) => s + b.paidAmount, 0)

  // Use dueRent API for actual outstanding amounts (across all months, not just filtered)
  const totalDue = (dueRent ?? []).reduce((s, r) => s + r.amountDue, 0)
  const overdueCount = (dueRent ?? []).filter((r) => r.daysOverdue > 0).length

  function handleGenerate() {
    generateBills.mutate(
      { month: generateMonth, tenantId: generateTenantId || undefined },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Bills generated")
          setGenerateOpen(false)
          setMonthFilter(generateMonth)
          setGenerateTenantId("")
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Failed to generate bills")
        },
      },
    )
  }

  function handleApplyLateFees() {
    applyLateFees.mutate(undefined, {
      onSuccess: (data) => toast.success(`Late fees applied to ${data.updated} bills`),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
    })
  }

  function handleRecordPayment() {
    if (!paymentOpen || !paymentForm.amount) return
    recordPayment.mutate(
      {
        billId: paymentOpen.billId,
        amount: Number(paymentForm.amount),
        paymentDate: new Date().toISOString(),
        method: paymentForm.method,
        notes: paymentForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Payment recorded")
          setPaymentOpen(null)
          setPaymentForm({ amount: "", method: "cash", notes: "" })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      },
    )
  }

  function handleSetPromiseDate() {
    if (!promiseOpen) return
    setPromisedDate.mutate(
      { billId: promiseOpen.billId, promisedDate: promiseDate || null },
      {
        onSuccess: () => {
          toast.success("Promise date set")
          setPromiseOpen(null)
          setPromiseDate("")
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      },
    )
  }

  function handleDelete() {
    if (!voidConfirm) return
    voidBill.mutate(voidConfirm.billId, {
      onSuccess: () => {
        toast.success("Bill deleted")
        setVoidConfirm(null)
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete"),
    })
  }

  function handleAutoAllocate() {
    api.post(`/v1/properties/${propertyId}/payments/auto-allocate`, {})
      .then(() => {
        toast.success("Payments auto-allocated")
        qc.invalidateQueries({ queryKey: ["bills", propertyId] })
        qc.invalidateQueries({ queryKey: ["payments", propertyId] })
      })
      .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed"))
  }

  function handleCreateDeposit() {
    if (!depositForm.tenantId || !depositForm.amount) return
    createDeposit.mutate(
      { tenantId: depositForm.tenantId, amount: Number(depositForm.amount), notes: depositForm.notes || undefined },
      {
        onSuccess: () => {
          toast.success("Security deposit collected")
          setDepositOpen(false)
          setDepositForm({ tenantId: "", amount: "", notes: "" })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      },
    )
  }

  function handleCreateAdvance() {
    if (!advanceForm.tenantId || !advanceForm.amount) return
    createAdvance.mutate(
      { tenantId: advanceForm.tenantId, amount: Number(advanceForm.amount), notes: advanceForm.notes || undefined },
      {
        onSuccess: () => {
          toast.success("Advance payment recorded")
          setAdvanceOpen(false)
          setAdvanceForm({ tenantId: "", amount: "", notes: "" })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Rent & billing</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Invoices, payments, deposits, and advances for {propertyName}.
        </p>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList variant="line">
          <TabsTrigger value="invoices"><Receipt className="mr-1.5 h-4 w-4" /> Invoices</TabsTrigger>
          <TabsTrigger value="deposits"><ShieldCheck className="mr-1.5 h-4 w-4" /> Security Deposits</TabsTrigger>
          <TabsTrigger value="advances"><PiggyBank className="mr-1.5 h-4 w-4" /> Advance Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <StatCard label="Total invoices" value={totalInvoices} icon={FileText} />
            <StatCard label="Pending" value={pending} icon={CalendarClock} />
            <StatCard label="Partial" value={partial} icon={Minus} />
            <StatCard label="Overdue" value={overdueCount} icon={AlertTriangle} />
            <StatCard label="Total due" value={formatCurrency(totalDue)} icon={CreditCard} />
            <StatCard label="Collected this month" value={formatCurrency(collectedThisMonth)} icon={Banknote} />
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-9 shrink-0 rounded-lg border bg-background px-3 text-sm"
            >
              {getLast12Months().map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 shrink-0 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <Button variant="outline" size="sm" className="shrink-0" onClick={handleApplyLateFees}>
              <AlertTriangle className="mr-1 h-3 w-3" /> Late fees
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => toast.info("Reminders not yet implemented")}>
              <Send className="mr-1 h-3 w-3" /> Reminders
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={handleAutoAllocate}>
              <Zap className="mr-1 h-3 w-3" /> Auto-allocate
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => toast.info("Raise charge not yet implemented")}>
              <Plus className="mr-1 h-3 w-3" /> Raise charge
            </Button>
            <div className="ml-auto shrink-0">
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="mr-1 h-3 w-3" /> Generate Invoice
              </Button>
            </div>
          </div>

          {/* Invoice table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2.5 font-medium">TENANT</th>
                      <th className="px-3 py-2.5 font-medium">MONTH</th>
                      <th className="px-3 py-2.5 font-medium text-right">RENT</th>
                      <th className="px-3 py-2.5 font-medium text-right">PENDING</th>
                      <th className="px-3 py-2.5 font-medium">STATUS</th>
                      <th className="px-3 py-2.5 font-medium">DUE</th>
                      <th className="px-3 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b: any, i: number) => (
                      <tr key={b.id || i} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-medium">{b.tenantName}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{b.billMonth}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(b.rentAmount)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(b.balance)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{b.dueDate ? formatDateShort(b.dueDate) : "-"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setViewInvoice(b)}>
                              View
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPaymentOpen({ billId: b.id, tenantName: b.tenantName, balance: b.balance })}>
                              Pay
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPromiseOpen({ billId: b.id, tenantName: b.tenantName })}>
                              Promise
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setVoidConfirm({ billId: b.id, tenantName: b.tenantName })}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                  <span>Showing 1-{filtered.length} of {filtered.length}</span>
                </div>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y">
                {filtered.map((b: any, i: number) => (
                  <div key={b.id || i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{b.tenantName}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Month</p>
                        <p>{b.billMonth}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Due</p>
                        <p>{b.dueDate ? formatDateShort(b.dueDate) : "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rent</p>
                        <p className="font-mono">{formatCurrency(b.rentAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="font-mono">{formatCurrency(b.balance)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => setViewInvoice(b)}>
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => setPaymentOpen({ billId: b.id, tenantName: b.tenantName, balance: b.balance })}>
                        Pay
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => setPromiseOpen({ billId: b.id, tenantName: b.tenantName })}>
                        Promise
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => setVoidConfirm({ billId: b.id, tenantName: b.tenantName })}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                  Showing 1-{filtered.length} of {filtered.length}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No invoices</p>
              <p className="mt-1 text-xs text-muted-foreground">Generate invoices for the current month to get started.</p>
            </div>
          )}

          {/* Outstanding payments */}
          {(dueRent ?? []).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Outstanding payments</h3>
              <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">TENANT</th>
                        <th className="px-4 py-3 font-medium">ROOM</th>
                        <th className="px-4 py-3 font-medium">AMOUNT DUE</th>
                        <th className="px-4 py-3 font-medium">DAYS OVERDUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dueRent ?? []).map((r) => (
                        <tr key={r.tenantId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{r.tenantName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.roomNumber || "-"}</td>
                          <td className="px-4 py-3 font-mono">{formatCurrency(r.amountDue)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.daysOverdue > 30 ? "bg-red-50 text-red-700" :
                              r.daysOverdue > 0 ? "bg-amber-50 text-amber-700" :
                              "bg-zinc-100 text-zinc-700"
                            }`}>
                              {r.daysOverdue > 0 ? `${r.daysOverdue} days` : "Current"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y">
                  {(dueRent ?? []).map((r) => (
                    <div key={r.tenantId} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.tenantName}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.daysOverdue > 30 ? "bg-red-50 text-red-700" :
                          r.daysOverdue > 0 ? "bg-amber-50 text-amber-700" :
                          "bg-zinc-100 text-zinc-700"
                        }`}>
                          {r.daysOverdue > 0 ? `${r.daysOverdue} days` : "Current"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Room: {r.roomNumber || "-"}</span>
                        <span className="font-mono">{formatCurrency(r.amountDue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="deposits" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Security deposits collected from tenants.</p>
            <Button size="sm" onClick={() => setDepositOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Collect deposit
            </Button>
          </div>
          {(deposits ?? []).length > 0 ? (
            <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">TENANT</th>
                      <th className="px-4 py-3 font-medium">AMOUNT</th>
                      <th className="px-4 py-3 font-medium">STATUS</th>
                      <th className="px-4 py-3 font-medium">REFUNDED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deposits ?? []).map((d) => (
                      <tr key={d.deposit.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{d.tenantName}</td>
                        <td className="px-4 py-3 font-mono">{formatCurrency(d.deposit.amount)}</td>
                        <td className="px-4 py-3"><StatusBadge status={d.deposit.status} /></td>
                        <td className="px-4 py-3 font-mono">{formatCurrency(d.deposit.refundAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y">
                {(deposits ?? []).map((d) => (
                  <div key={d.deposit.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.tenantName}</span>
                      <StatusBadge status={d.deposit.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Amount: {formatCurrency(d.deposit.amount)}</span>
                      <span>Refunded: {formatCurrency(d.deposit.refundAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No security deposits</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advances" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Advance payments collected from tenants.</p>
            <Button size="sm" onClick={() => setAdvanceOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Collect advance
            </Button>
          </div>
          {(advances ?? []).length > 0 ? (
            <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">TENANT</th>
                      <th className="px-4 py-3 font-medium">AMOUNT</th>
                      <th className="px-4 py-3 font-medium">STATUS</th>
                      <th className="px-4 py-3 font-medium">APPLIED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(advances ?? []).map((a) => (
                      <tr key={a.advance.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{a.tenantName}</td>
                        <td className="px-4 py-3 font-mono">{formatCurrency(a.advance.amount)}</td>
                        <td className="px-4 py-3"><StatusBadge status={a.advance.status} /></td>
                        <td className="px-4 py-3 font-mono">{formatCurrency(a.advance.appliedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y">
                {(advances ?? []).map((a) => (
                  <div key={a.advance.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.tenantName}</span>
                      <StatusBadge status={a.advance.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Amount: {formatCurrency(a.advance.amount)}</span>
                      <span>Applied: {formatCurrency(a.advance.appliedAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <PiggyBank className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No advance payments</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Generate invoice dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate invoices</DialogTitle>
            <DialogDescription>Select a month and generate bills for all active tenants.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Month</label>
              <select
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {getLast12Months().map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant</label>
              <select
                value={generateTenantId}
                onChange={(e) => setGenerateTenantId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">All tenants</option>
                {(tenants ?? []).filter((t) => t.status === "active").map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate} disabled={generateBills.isPending}>
              {generateBills.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!paymentOpen} onOpenChange={() => setPaymentOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Record payment for {paymentOpen?.tenantName}. Balance: {formatCurrency(paymentOpen?.balance ?? 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount <span className="text-destructive">*</span></label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Method</label>
              <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(null)}>Cancel</Button>
            <Button size="sm" onClick={handleRecordPayment} disabled={recordPayment.isPending || !paymentForm.amount}>
              {recordPayment.isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promise date dialog */}
      <Dialog open={!!promiseOpen} onOpenChange={() => setPromiseOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set promise date</DialogTitle>
            <DialogDescription>Set a promised payment date for {promiseOpen?.tenantName}. Late fees are suspended until this date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Promise date</label>
            <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPromiseOpen(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSetPromiseDate} disabled={setPromisedDate.isPending}>
              {setPromisedDate.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!voidConfirm}
        onOpenChange={() => setVoidConfirm(null)}
        title="Delete invoice"
        description={`Delete the invoice for ${voidConfirm?.tenantName}? This will permanently remove the bill and cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={voidBill.isPending}
        onConfirm={handleDelete}
      />

      {/* Collect deposit dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect security deposit</DialogTitle>
            <DialogDescription>Record a security deposit collected from a tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant <span className="text-destructive">*</span></label>
              <select
                value={depositForm.tenantId}
                onChange={(e) => setDepositForm({ ...depositForm, tenantId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select tenant</option>
                {(tenants ?? []).filter((t) => t.status === "active").map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount <span className="text-destructive">*</span></label>
              <Input type="number" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={depositForm.notes} onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateDeposit} disabled={createDeposit.isPending || !depositForm.tenantId || !depositForm.amount}>
              {createDeposit.isPending ? "Collecting..." : "Collect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect advance dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect advance payment</DialogTitle>
            <DialogDescription>Record an advance payment collected from a tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tenant <span className="text-destructive">*</span></label>
              <select
                value={advanceForm.tenantId}
                onChange={(e) => setAdvanceForm({ ...advanceForm, tenantId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select tenant</option>
                {(tenants ?? []).filter((t) => t.status === "active").map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.phone})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount <span className="text-destructive">*</span></label>
              <Input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateAdvance} disabled={createAdvance.isPending || !advanceForm.tenantId || !advanceForm.amount}>
              {createAdvance.isPending ? "Collecting..." : "Collect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice view dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {viewInvoice && (
            <InvoiceTemplate
              businessName={propertyName}
              tenantName={viewInvoice.tenantName}
              roomNumber={viewInvoice.roomNumber}
              invoiceNo={`RENT-${viewInvoice.billMonth}`}
              issueDate={viewInvoice.createdAt}
              dueDate={viewInvoice.dueDate}
              billMonth={viewInvoice.billMonth}
              lineItems={viewInvoice.lineItems || []}
              totalAmount={viewInvoice.totalAmount}
              paidAmount={viewInvoice.paidAmount}
              balance={viewInvoice.balance}
              status={viewInvoice.status}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
