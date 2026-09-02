"use client"

import { useState } from "react"
import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useFloors, useCreateFloor } from "@/hooks/use-floors"
import { useRooms } from "@/hooks/use-rooms"
import { useBeds } from "@/hooks/use-beds"
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
import {
  Bed,
  Download,
  LayoutGrid,
  Layers,
  Plus,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"

type Tab = "floors" | "rooms" | "beds"

export default function StructurePage() {
  const { selectedProperty } = useSelectedProperty()
  const [activeTab, setActiveTab] = useState<Tab>("floors")
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [floorName, setFloorName] = useState("")
  const [floorNumber, setFloorNumber] = useState("0")
  const [floorDescription, setFloorDescription] = useState("")

  const propertyId = selectedProperty?.id ?? ""

  const { data: floors, isLoading: floorsLoading } = useFloors(propertyId)
  const { data: rooms, isLoading: roomsLoading } = useRooms(propertyId)
  const { data: beds, isLoading: bedsLoading } = useBeds(propertyId)
  const createFloor = useCreateFloor(propertyId)

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "floors", label: "Floors", icon: Layers },
    { id: "rooms", label: "Rooms", icon: LayoutGrid },
    { id: "beds", label: "Beds", icon: Bed },
  ]

  const isLoading = floorsLoading || roomsLoading || bedsLoading

  function handleCreateFloor() {
    if (!floorName.trim()) return
    createFloor.mutate(
      {
        name: floorName.trim(),
        position: Number(floorNumber) || 0,
        description: floorDescription.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Floor created")
          resetFloorForm()
          setAddFloorOpen(false)
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Failed to create floor",
          ),
      },
    )
  }

  function resetFloorForm() {
    setFloorName("")
    setFloorNumber("0")
    setFloorDescription("")
  }

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Floors, Rooms & Beds</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a property from the header to manage its structure.
          </p>
        </div>
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No property selected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the property selector in the header to choose a property.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Floors, Rooms & Beds</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Property → Floor → Room → Bed. The hierarchy is strict.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAddFloorOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add {activeTab === "floors" ? "floor" : activeTab === "rooms" ? "room" : "bed"}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : activeTab === "floors" ? (
        floors && floors.length > 0 ? (
          <div className="space-y-2">
            {floors.map((f) => (
              <div
                key={f.floor.id}
                className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all hover:shadow-md"
              >
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{f.floor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.roomCount} {f.roomCount === 1 ? "room" : "rooms"}
                    </p>
                  </div>
                </div>
                <Link href={`/dashboard/properties/${propertyId}/rooms`}>
                  <Button variant="ghost" size="sm">
                    View rooms
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No floors yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first floor to start building out rooms and beds.
            </p>
          </div>
        )
      ) : activeTab === "rooms" ? (
        rooms && rooms.length > 0 ? (
          <div className="space-y-2">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all hover:shadow-md"
              >
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Room {r.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.type} · Capacity {r.capacity} · ₹{r.monthlyRent}/mo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.beds?.length ?? 0} beds
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No rooms yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add floors first, then create rooms within them.
            </p>
          </div>
        )
      ) : beds && beds.length > 0 ? (
        <div className="space-y-2">
          {beds.map((b) => (
            <div
              key={b.bed.id}
              className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all hover:shadow-md"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Bed className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {b.roomNumber}-{b.bed.number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.floorName ? `${b.floorName} · ` : ""}Room {b.roomNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.bed.status === "occupied"
                      ? "bg-zinc-100 text-zinc-700"
                      : b.bed.status === "maintenance"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {b.bed.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Bed className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No beds yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add rooms first, then create beds within them.
          </p>
        </div>
      )}

      {/* Add floor dialog */}
      <Dialog open={addFloorOpen} onOpenChange={setAddFloorOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add floor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Floor name</label>
              <Input
                placeholder="Ground, First, Second..."
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Floor number</label>
              <Input
                type="number"
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={floorDescription}
                onChange={(e) => setFloorDescription(e.target.value)}
                className="flex min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetFloorForm()
                setAddFloorOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFloor}
              disabled={!floorName.trim() || createFloor.isPending}
            >
              {createFloor.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
