"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useProperties } from "@/hooks/use-properties"
import { useProperty, useUpdateProperty } from "@/hooks/use-properties"
import { useReadings, useCreateReading, useDeleteReading, useUpdateReading, type ReadingWithRoom } from "@/hooks/use-readings"
import { useRooms } from "@/hooks/use-rooms"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatDateShort, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Zap,
  Plus,
  Search,
  Activity,
  Hash,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react"

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

export default function ReadingsPage() {
  const { selectedProperty, setSelectedProperty } = useSelectedProperty()

  if (!selectedProperty) {
    return <PropertySelector />
  }

  return <ReadingsContent propertyId={selectedProperty.id} propertyName={selectedProperty.name} />
}

function PropertySelector() {
  const { setSelectedProperty } = useSelectedProperty()
  const { data: properties, isLoading } = useProperties()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Meter reading</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Select a property to manage meter readings.</p>
      </div>
      {isLoading ? (
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
              <span className="text-xs text-muted-foreground">View readings</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No properties</p>
        </div>
      )}
    </div>
  )
}

function ReadingsContent({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { data: readings, isLoading } = useReadings(propertyId)
  const { data: rooms } = useRooms(propertyId)
  const { data: property } = useProperty(propertyId)
  const createReading = useCreateReading(propertyId)
  const updateReading = useUpdateReading(propertyId)
  const deleteReading = useDeleteReading(propertyId)
  const updateProperty = useUpdateProperty(propertyId)

  const [addOpen, setAddOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [electricityRate, setElectricityRate] = useState("")
  const [search, setSearch] = useState("")
  const [monthFilter, setMonthFilter] = useState("")
  const [form, setForm] = useState({ roomId: "", reading: "", readingDate: new Date().toISOString().split("T")[0] })
  const [editTarget, setEditTarget] = useState<ReadingWithRoom | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReadingWithRoom | null>(null)

  const allReadings = readings ?? []
  const totalReadings = allReadings.length
  const totalUnits = allReadings.reduce((sum, r) => sum + r.reading.units, 0)
  const roomsWithReadings = new Set(allReadings.map((r) => r.reading.roomId)).size

  const filtered = allReadings.filter((r) => {
    const matchesSearch = !search || r.roomNumber.toLowerCase().includes(search.toLowerCase())
    const matchesMonth = !monthFilter || r.reading.readingDate.startsWith(monthFilter)
    return matchesSearch && matchesMonth
  })

  function handleAdd() {
    if (!form.roomId || !form.reading) {
      toast.error("Fill in all required fields")
      return
    }
    createReading.mutate(
      {
        roomId: form.roomId,
        reading: Number(form.reading),
        readingDate: form.readingDate,
      },
      {
        onSuccess: () => {
          toast.success("Reading recorded")
          setForm({ roomId: "", reading: "", readingDate: new Date().toISOString().split("T")[0] })
          setAddOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to record reading"),
      },
    )
  }

  function handleEdit() {
    if (!editTarget || !form.reading || !form.readingDate) return
    updateReading.mutate(
      { readingId: editTarget.reading.id, reading: Number(form.reading), readingDate: form.readingDate },
      {
        onSuccess: () => {
          toast.success("Reading updated")
          setEditTarget(null)
          setForm({ roomId: "", reading: "", readingDate: new Date().toISOString().split("T")[0] })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update reading"),
      },
    )
  }

  function openEdit(reading: ReadingWithRoom) {
    setEditTarget(reading)
    setForm({
      roomId: reading.reading.roomId,
      reading: String(reading.reading.reading),
      readingDate: reading.reading.readingDate.slice(0, 10),
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteReading.mutate(deleteTarget.reading.id, {
      onSuccess: () => {
        toast.success("Reading deleted")
        setDeleteTarget(null)
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete reading"),
    })
  }

  function openRateDialog() {
    setElectricityRate(property?.electricityRatePerUnit?.toString() || "")
    setRateOpen(true)
  }

  function handleSaveRate() {
    const rate = Number(electricityRate)
    if (isNaN(rate) || rate < 0) {
      toast.error("Enter a valid rate")
      return
    }
    updateProperty.mutate(
      { electricityRatePerUnit: rate, electricityMode: "meter" },
      {
        onSuccess: () => {
          toast.success("Electricity rate updated")
          setRateOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to update rate"),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Meter reading</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Electricity meter readings for {propertyName}.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total readings" value={totalReadings} icon={Hash} />
        <StatCard label="Total units consumed" value={totalUnits} icon={Activity} />
        <StatCard label="Rooms tracked" value={roomsWithReadings} icon={Zap} />
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">All months</option>
            {getLast12Months().map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={openRateDialog}>
            <Zap className="mr-1.5 h-4 w-4" /> Rate
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Reading
          </Button>
        </div>
      </div>

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
                  <th className="px-3 py-2.5 font-medium">ROOM</th>
                  <th className="px-3 py-2.5 font-medium text-right">PREVIOUS</th>
                  <th className="px-3 py-2.5 font-medium text-right">CURRENT</th>
                  <th className="px-3 py-2.5 font-medium text-right">UNITS</th>
                  <th className="px-3 py-2.5 font-medium">DATE</th>
                  <th className="px-3 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  // Find previous reading for same room
                  const prev = allReadings
                    .filter((x) => x.reading.roomId === r.reading.roomId && new Date(x.reading.readingDate) < new Date(r.reading.readingDate))
                    .sort((a, b) => new Date(b.reading.readingDate).getTime() - new Date(a.reading.readingDate).getTime())[0]
                  const previousReading = prev ? prev.reading.reading : 0

                  return (
                    <tr key={r.reading.id} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{r.roomNumber}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{previousReading}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.reading.reading}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium">{r.reading.units}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDateShort(r.reading.readingDate)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(r)} aria-label={`Edit reading for room ${r.roomNumber}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(r)} aria-label={`Delete reading for room ${r.roomNumber}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-3 py-2.5 text-xs text-muted-foreground">
              <span>Showing 1-{filtered.length} of {filtered.length}</span>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((r, i) => {
              const prev = allReadings
                .filter((x) => x.reading.roomId === r.reading.roomId && new Date(x.reading.readingDate) < new Date(r.reading.readingDate))
                .sort((a, b) => new Date(b.reading.readingDate).getTime() - new Date(a.reading.readingDate).getTime())[0]
              const previousReading = prev ? prev.reading.reading : 0

              return (
                <div key={r.reading.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Room {r.roomNumber}</span>
                    <span className="text-sm text-muted-foreground">{formatDateShort(r.reading.readingDate)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Previous</p>
                      <p className="font-mono text-muted-foreground">{previousReading}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="font-mono">{r.reading.reading}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Units</p>
                      <p className="font-mono font-medium">{r.reading.units}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEdit(r)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No readings yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Record your first meter reading to start tracking electricity usage.
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium">How electricity billing works</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>1. Meter readings are recorded <strong>per room</strong> (not per bed).</p>
          <p>2. Units consumed = Current reading - Previous reading.</p>
          <p>3. The <strong>first reading is the opening reading</strong>; the <strong>second reading closes the period</strong>. Only their difference is billed.</p>
          <p>4. When a tenant joins during that period, their share is based on the days they actually stayed. Bills generated late still use the same two reading dates.</p>
          <p className="pl-4">Example: Room 101 uses 100 units at ₹8/unit = ₹800. A tenant who stayed half the reading period pays ₹400.</p>
          <p className="mt-2 font-medium text-foreground">PG billing cycle</p>
          <p>5. <strong>Rent</strong> is collected in advance and is automatically prorated from a new tenant&apos;s joining date.</p>
          <p>6. <strong>Electricity</strong> uses the two readings ending in the invoice month — an Aug 1 opening and Sep 2 closing reading appear on the September bill.</p>
          <p>7. Record an opening reading, then the closing reading. The closing reading is used with the immediately previous reading, even if you generate the bill later.</p>
        </div>
      </div>

      {/* Add reading dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add meter reading</DialogTitle>
            <DialogDescription>Record an electricity meter reading for a room.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Room <span className="text-destructive">*</span></label>
              <select
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select room</option>
                {(rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>Room {r.number}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meter reading (units) <span className="text-destructive">*</span></label>
              <Input
                type="number"
                value={form.reading}
                onChange={(e) => setForm({ ...form, reading: e.target.value })}
                placeholder="e.g. 12345"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reading date <span className="text-destructive">*</span></label>
              <Input
                type="date"
                value={form.readingDate}
                onChange={(e) => setForm({ ...form, readingDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={createReading.isPending || !form.roomId || !form.reading}>
              {createReading.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit meter reading</DialogTitle>
            <DialogDescription>Update the reading. Adjacent units will be recalculated automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Room</label>
              <Input value={editTarget ? `Room ${editTarget.roomNumber}` : ""} disabled />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meter reading <span className="text-destructive">*</span></label>
              <Input type="number" value={form.reading} onChange={(e) => setForm({ ...form, reading: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reading date <span className="text-destructive">*</span></label>
              <Input type="date" value={form.readingDate} onChange={(e) => setForm({ ...form, readingDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleEdit} disabled={updateReading.isPending || !form.reading}>
              {updateReading.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Electricity rate dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Electricity rate</DialogTitle>
            <DialogDescription>
              Set the per-unit rate for electricity billing. This is used when generating bills to calculate each tenant's share.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rate per unit (₹) <span className="text-destructive">*</span></label>
              <Input
                type="number"
                value={electricityRate}
                onChange={(e) => setElectricityRate(e.target.value)}
                placeholder="8"
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How it works</p>
              <p className="mt-1">When bills are generated, each tenant's electricity charge is calculated as:</p>
              <p className="mt-1 font-mono">(units consumed × rate) ÷ occupants in room</p>
              <p className="mt-1">Example: 100 units at ₹8/unit with 2 tenants in the room = ₹400 each.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveRate} disabled={updateProperty.isPending}>
              {updateProperty.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete meter reading"
        description={`Delete the ${deleteTarget?.reading.reading} reading for Room ${deleteTarget?.roomNumber}? The next reading will be recalculated.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteReading.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
