"use client"

import { Fragment, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useBills, useGenerateBills, useApproveBills, useApplyLateFees, useDeleteBill, useSetPromisedDate, useBillingPreflight, useSaveReadingBatch, useDeliverBill, useShareBill, type MeterPreflight } from "@/hooks/use-bills"
import { useProperty } from "@/hooks/use-properties"
import { useTenantAdvancePayments, useApplyAdvancePayment } from "@/hooks/use-advance-payments"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency, formatMonth, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Clock, FileCheck, Play, Send, Share2, Wallet } from "lucide-react"

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return d.toISOString().slice(0, 7)
}

export default function BillingPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const [month, setMonth] = useState(getCurrentMonth())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [preflight, setPreflight] = useState<MeterPreflight | null>(null)
  const [readingsOpen, setReadingsOpen] = useState(false)
  const [readingValues, setReadingValues] = useState<Record<string, { reading: string; date: string }>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deliveryDialog, setDeliveryDialog] = useState<{ billId: string; tenantName: string } | null>(null)
  const [deliveryChannels, setDeliveryChannels] = useState<Array<"email" | "whatsapp">>(["email"])

  // Advance payment dialog state
  const [advanceDialog, setAdvanceDialog] = useState<{ billId: string; tenantId: string; tenantName: string; billBalance: number } | null>(null)
  const [selectedAdvanceId, setSelectedAdvanceId] = useState("")
  const [advanceAmount, setAdvanceAmount] = useState("")

  const { data: property } = useProperty(propertyId)
  const { data: bills, isLoading } = useBills(propertyId, month)
  const generateBills = useGenerateBills(propertyId)
  const approveBills = useApproveBills(propertyId)
  const applyLateFees = useApplyLateFees(propertyId)
  const voidBill = useDeleteBill(propertyId)
  const setPromisedDate = useSetPromisedDate(propertyId)
  const applyAdvance = useApplyAdvancePayment(propertyId)
  const billingPreflight = useBillingPreflight(propertyId)
  const saveReadingBatch = useSaveReadingBatch(propertyId)
  const deliverBill = useDeliverBill(propertyId)
  const shareBill = useShareBill(propertyId)

  // Fetch advances for the tenant in the dialog
  const { data: tenantAdvances } = useTenantAdvancePayments(
    propertyId,
    advanceDialog?.tenantId || "",
  )

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!bills) return
    if (selected.size === bills.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(bills.map((b) => b.id)))
    }
  }

  function generateAfterConfirmation() {
    generateBills.mutate({ month }, {
      onSuccess: (res) => { setConfirmOpen(false); toast.success(res.message) },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to generate bills"),
    })
  }

  function handleGenerate() {
    billingPreflight.mutate({ month }, {
      onSuccess: (result) => {
        if (result.complete) setConfirmOpen(true)
        else {
          setPreflight(result)
          setReadingValues(Object.fromEntries(result.missingRooms.map((r) => [r.roomId, { reading: String(r.latestReading?.reading ?? ""), date: new Date().toISOString().slice(0, 10) }])))
        }
      },
      onError: () => toast.error("Could not check meter readings"),
    })
  }

  function saveMissingReadings() {
    if (!preflight) return
    const readings = preflight.missingRooms.map((room) => ({ roomId: room.roomId, reading: Number(readingValues[room.roomId]?.reading), readingDate: readingValues[room.roomId]?.date }))
    if (readings.some((r) => !Number.isFinite(r.reading) || !r.readingDate)) return toast.error("Enter a reading and date for every room")
    saveReadingBatch.mutate(readings, { onSuccess: () => { setPreflight(null); setReadingsOpen(false); setConfirmOpen(true); toast.success("Meter readings saved") }, onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not save readings") })
  }

  function handleShare(billId: string) {
    shareBill.mutate(billId, { onSuccess: async ({ message }) => {
      try { if (navigator.share) await navigator.share({ title: "PGKhata bill", text: message }); else { await navigator.clipboard.writeText(message); toast.success("Bill message copied") } }
      catch (error) { if ((error as Error).name !== "AbortError") { await navigator.clipboard.writeText(message); toast.success("Bill message copied") } }
    }, onError: () => toast.error("Could not create bill link") })
  }

  function handleApprove() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    approveBills.mutate(ids, {
      onSuccess: (res) => {
        toast.success(res.message)
        setSelected(new Set())
      },
      onError: () => toast.error("Failed to approve bills"),
    })
  }

  function handleApplyLateFees() {
    const ids = selected.size > 0 ? Array.from(selected) : undefined
    applyLateFees.mutate(ids, {
      onSuccess: (res) => toast.success(res.message),
      onError: () => toast.error("Failed to apply late fees"),
    })
  }

  function handleVoid(billId: string, tenantName: string) {
    if (!confirm(`Void this bill for ${tenantName}? The record will be preserved but the balance zeroed.`)) return
    voidBill.mutate(billId, {
      onSuccess: () => toast.success("Bill voided; payment history preserved"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to void bill"),
    })
  }

  function handleSetPromisedDate(billId: string) {
    const date = prompt("Enter promised payment date (YYYY-MM-DD), or leave empty to clear:")
    if (date === null) return // cancelled
    const value = date.trim() === "" ? null : date
    setPromisedDate.mutate(
      { billId, promisedDate: value },
      {
        onSuccess: (res) => toast.success(res.message),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to set promised date"),
      },
    )
  }

  function handleApplyAdvance() {
    if (!advanceDialog || !selectedAdvanceId) return
    const amount = advanceAmount ? Number(advanceAmount) : undefined
    applyAdvance.mutate(
      { advanceId: selectedAdvanceId, billId: advanceDialog.billId, amount },
      {
        onSuccess: (res) => {
          toast.success(res.message)
          setAdvanceDialog(null)
          setSelectedAdvanceId("")
          setAdvanceAmount("")
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to apply advance"),
      },
    )
  }

  function openAdvanceDialog(billId: string, tenantId: string, tenantName: string, billBalance: number) {
    setAdvanceDialog({ billId, tenantId, tenantName, billBalance })
    setSelectedAdvanceId("")
    setAdvanceAmount("")
  }

  const totalBilled = bills?.reduce((sum, b) => sum + b.totalAmount, 0) ?? 0
  const totalPaid = bills?.reduce((sum, b) => sum + b.paidAmount, 0) ?? 0
  const totalBalance = bills?.reduce((sum, b) => sum + b.balance, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/properties/${propertyId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Billing</h1>
          {property && (
            <p className="text-xs text-muted-foreground">{property.name}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {formatMonth(month)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" onClick={handleGenerate} disabled={generateBills.isPending || billingPreflight.isPending}>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {generateBills.isPending ? "Generating..." : billingPreflight.isPending ? "Checking meters..." : "Generate bills"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleApplyLateFees}
          disabled={applyLateFees.isPending}
        >
          <Clock className="mr-1.5 h-3.5 w-3.5" />
          {applyLateFees.isPending
            ? "Applying..."
            : selected.size > 0
              ? `Apply late fees (${selected.size})`
              : "Apply late fees to all overdue"}
        </Button>

        {selected.size > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleApprove}
            disabled={approveBills.isPending}
          >
            <FileCheck className="mr-1.5 h-3.5 w-3.5" />
            Approve ({selected.size})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : bills && bills.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">
                    <input
                      type="checkbox"
                      checked={selected.size === bills.length}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5"
                    />
                  </th>
                  <th className="pb-2 font-medium">Tenant</th>
                  <th className="pb-2 font-medium">Room</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Paid</th>
                  <th className="pb-2 font-medium text-right">Balance</th>
                  <th className="pb-2 font-medium">Due</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const isExpanded = expanded.has(b.id)
                  return (
                    <Fragment key={b.id}>
                      <tr
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleExpanded(b.id)}
                      >
                        <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            className="h-3.5 w-3.5"
                          />
                        </td>
                        <td className="py-2.5 font-medium">{b.tenantName}</td>
                        <td className="py-2.5 font-mono text-muted-foreground">{b.roomNumber}</td>
                        <td className="py-2.5 text-right font-mono font-medium">
                          {formatCurrency(b.totalAmount)}
                        </td>
                        <td className="py-2.5 text-right font-mono">{formatCurrency(b.paidAmount)}</td>
                        <td className="py-2.5 text-right font-mono">{formatCurrency(b.balance)}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {b.dueDate ? formatDateShort(b.dueDate) : "—"}
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="py-2.5 text-right">
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-muted/30">
                          <td />
                          <td colSpan={7} className="py-2 pl-1">
                            <ul className="space-y-0.5 text-xs">
                              {b.lineItems.map((line, i) => (
                                <li
                                  key={`${b.id}-${line.code}-${i}`}
                                  className="flex justify-between gap-4 text-muted-foreground"
                                >
                                  <span>{line.name}</span>
                                  <span className="font-mono">{formatCurrency(line.amount)}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 pt-2 border-t border-muted-foreground/20 flex gap-2">
                              {!b.voidedAt && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setDeliveryDialog({ billId: b.id, tenantName: b.tenantName }) }}>
                                    <Send className="mr-1 h-3 w-3" /> Send bill
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleShare(b.id) }}>
                                    <Share2 className="mr-1 h-3 w-3" /> Share bill
                                  </Button>
                                </>
                              )}
                              {b.balance > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openAdvanceDialog(b.id, b.tenantId, b.tenantName, b.balance)
                                  }}
                                >
                                  <Wallet className="mr-1 h-3 w-3" />
                                  Apply advance
                                </Button>
                              )}
                              {!b.voidedAt && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleVoid(b.id, b.tenantName)
                                    }}
                                  >
                                    Void bill
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSetPromisedDate(b.id)
                                    }}
                                  >
                                    {b.promisedDate ? "Change promised date" : "Set promised date"}
                                  </Button>
                                </>
                              )}
                              {b.voidedAt && (
                                <span className="text-xs text-muted-foreground italic">Voided</span>
                              )}
                              {b.promisedDate && !b.voidedAt && (
                                <span className="text-xs text-muted-foreground">
                                  Promised: {formatDateShort(b.promisedDate)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-6 border-t pt-3 text-sm">
            <div>
              <span className="text-muted-foreground">Billed: </span>
              <span className="font-mono font-medium">{formatCurrency(totalBilled)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Collected: </span>
              <span className="font-mono font-medium">{formatCurrency(totalPaid)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Balance: </span>
              <span className="font-mono font-medium">{formatCurrency(totalBalance)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No bills for {formatMonth(month)}.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click “Generate bills” to create bills for this month.
          </p>
        </div>
      )}

      <Dialog open={!!preflight && !readingsOpen} onOpenChange={(open) => !open && setPreflight(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Meter readings needed</DialogTitle><DialogDescription>
            {preflight?.missingRooms.length} room{preflight?.missingRooms.length === 1 ? " is" : "s are"} missing a closing reading for {formatMonth(month)}. Add them now before bills can be generated?
          </DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPreflight(null)}>No, not now</Button><Button onClick={() => setReadingsOpen(true)}>Yes, add readings</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={readingsOpen} onOpenChange={(open) => { setReadingsOpen(open); if (!open) setPreflight(null) }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add closing readings</DialogTitle><DialogDescription>Each room uses its latest value as a starting point. A first value is saved as a zero-unit baseline.</DialogDescription></DialogHeader>
          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">{preflight?.missingRooms.map((room) => (<div key={room.roomId} className="grid grid-cols-[1fr_110px_130px] items-end gap-2 rounded-md border p-3">
            <div><p className="text-sm font-medium">Room {room.roomNumber}</p><p className="text-xs text-muted-foreground">{room.tenants.map((t) => t.name).join(", ")} · Last: {room.latestReading ? `${room.latestReading.reading} (${formatDateShort(room.latestReading.readingDate)})` : "no reading"}</p></div>
            <label className="space-y-1 text-xs text-muted-foreground">New reading<Input type="number" min="0" value={readingValues[room.roomId]?.reading ?? ""} onChange={(e) => setReadingValues((v) => ({ ...v, [room.roomId]: { ...v[room.roomId], reading: e.target.value } }))} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Reading date<Input type="date" value={readingValues[room.roomId]?.date ?? ""} onChange={(e) => setReadingValues((v) => ({ ...v, [room.roomId]: { ...v[room.roomId], date: e.target.value } }))} /></label>
          </div>))}</div>
          <DialogFooter><Button variant="outline" onClick={() => { setReadingsOpen(false); setPreflight(null) }}>Cancel</Button><Button disabled={saveReadingBatch.isPending} onClick={saveMissingReadings}>{saveReadingBatch.isPending ? "Saving..." : "Save readings"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Generate {formatMonth(month)} bills?</DialogTitle><DialogDescription>Bills will include rent, metered electricity where a reading pair exists, and active recurring charges. Review is complete.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button disabled={generateBills.isPending} onClick={generateAfterConfirmation}>{generateBills.isPending ? "Generating..." : "Confirm & generate"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!deliveryDialog} onOpenChange={(open) => !open && setDeliveryDialog(null)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Send bill</DialogTitle><DialogDescription>Send {deliveryDialog?.tenantName} their secure bill link. Unavailable channels are reported after sending.</DialogDescription></DialogHeader><ChannelChoices value={deliveryChannels} onChange={setDeliveryChannels} /><DialogFooter><Button variant="outline" onClick={() => setDeliveryDialog(null)}>Cancel</Button><Button disabled={!deliveryChannels.length || deliverBill.isPending} onClick={() => deliveryDialog && deliverBill.mutate({ billId: deliveryDialog.billId, channels: deliveryChannels }, { onSuccess: ({ results }) => { setDeliveryDialog(null); toast.success(results.map((r) => `${r.channel}: ${r.status}`).join(" · ")) }, onError: () => toast.error("Could not send bill") })}>{deliverBill.isPending ? "Sending..." : "Send"}</Button></DialogFooter></DialogContent></Dialog>


      {/* Apply advance payment dialog */}
      <Dialog open={!!advanceDialog} onOpenChange={(open) => !open && setAdvanceDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply advance payment</DialogTitle>
            <DialogDescription>
              Apply an available advance to {advanceDialog?.tenantName}&apos;s bill.
              Balance: {formatCurrency(advanceDialog?.billBalance ?? 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Advance *</label>
              <select
                value={selectedAdvanceId}
                onChange={(e) => {
                  setSelectedAdvanceId(e.target.value)
                  // Default amount to min(advance available, bill balance)
                  const advance = tenantAdvances?.find((a) => a.id === e.target.value)
                  if (advance && advanceDialog) {
                    const available = advance.amount - advance.appliedAmount
                    setAdvanceAmount(String(Math.min(available, advanceDialog.billBalance)))
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select an advance</option>
                {tenantAdvances
                  ?.filter((a) => a.status === "available" && a.amount > a.appliedAmount)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatCurrency(a.amount - a.appliedAmount)} available ({formatDateShort(a.date)})
                    </option>
                  ))}
              </select>
              {tenantAdvances?.filter((a) => a.status === "available" && a.amount > a.appliedAmount).length === 0 && (
                <p className="text-xs text-muted-foreground">No available advances for this tenant.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input
                type="number"
                placeholder="Full available amount"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty to apply the maximum available.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdvanceDialog(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedAdvanceId || applyAdvance.isPending}
              onClick={handleApplyAdvance}
            >
              {applyAdvance.isPending ? "Applying..." : "Apply advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChannelChoices({ value, onChange }: { value: Array<"email" | "whatsapp">; onChange: (value: Array<"email" | "whatsapp">) => void }) {
  return <div className="flex gap-4 text-sm">{(["email", "whatsapp"] as const).map((channel) => <label key={channel} className="flex items-center gap-2 capitalize"><input type="checkbox" checked={value.includes(channel)} onChange={() => onChange(value.includes(channel) ? value.filter((v) => v !== channel) : [...value, channel])} />{channel}</label>)}</div>
}
