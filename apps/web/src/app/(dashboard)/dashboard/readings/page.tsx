"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useProperties } from "@/hooks/use-properties"
import { useReadings, useCreateReading } from "@/hooks/use-readings"
import { useRooms } from "@/hooks/use-rooms"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatDateShort, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
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
  const createReading = useCreateReading(propertyId)

  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [monthFilter, setMonthFilter] = useState("")
  const [form, setForm] = useState({ roomId: "", reading: "", readingDate: new Date().toISOString().split("T")[0] })

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
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add reading
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">ROOM</th>
                  <th className="px-3 py-2.5 font-medium text-right">PREVIOUS</th>
                  <th className="px-3 py-2.5 font-medium text-right">CURRENT</th>
                  <th className="px-3 py-2.5 font-medium text-right">UNITS</th>
                  <th className="px-3 py-2.5 font-medium">DATE</th>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-3 py-2.5 text-xs text-muted-foreground">
              <span>Showing 1-{filtered.length} of {filtered.length}</span>
            </div>
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
          <p>3. When bills are generated, the cost is split equally among all occupants in the room.</p>
          <p className="pl-4">Example: Room 101 has 2 tenants, 100 units consumed at ₹8/unit = ₹800 total → ₹400 per tenant.</p>
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
    </div>
  )
}
