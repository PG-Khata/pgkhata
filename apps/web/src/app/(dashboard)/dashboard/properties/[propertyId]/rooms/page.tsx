"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useRooms, useDeleteRoom } from "@/hooks/use-rooms"
import { useProperty } from "@/hooks/use-properties"
import {
  useFloors,
  useCreateFloor,
  useDeleteFloor,
  useReorderFloors,
} from "@/hooks/use-floors"
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
import { formatCurrency } from "@/lib/utils"
import { groupRoomsByFloor, structureTotals } from "@/lib/structure"
import { ApiError } from "@/lib/api-client"

export default function StructurePage() {
  const params = useParams()
  const propertyId = params.propertyId as string

  const { data: property } = useProperty(propertyId)
  const { data: floors, isLoading: floorsLoading } = useFloors(propertyId)
  const { data: rooms, isLoading: roomsLoading } = useRooms(propertyId)

  const createFloor = useCreateFloor(propertyId)
  const deleteFloor = useDeleteFloor(propertyId)
  const reorderFloors = useReorderFloors(propertyId)
  const deleteRoom = useDeleteRoom(propertyId)

  const [floorDialogOpen, setFloorDialogOpen] = useState(false)
  const [floorName, setFloorName] = useState("")

  const groups = useMemo(
    () => groupRoomsByFloor(floors ?? [], rooms ?? []),
    [floors, rooms],
  )
  const totals = structureTotals(groups)
  const isLoading = floorsLoading || roomsLoading

  function handleAddFloor() {
    const name = floorName.trim()
    if (!name) return

    createFloor.mutate(
      { name },
      {
        onSuccess: () => {
          toast.success(`${name} added`)
          setFloorName("")
          setFloorDialogOpen(false)
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Failed to add floor",
          ),
      },
    )
  }

  function handleDeleteFloor(floorId: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return
    deleteFloor.mutate(floorId, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : "Failed to delete floor",
        ),
    })
  }

  function handleMoveFloor(floorId: string, direction: -1 | 1) {
    const ordered = groups.filter((g) => g.floor).map((g) => g.floor!.id)
    const from = ordered.indexOf(floorId)
    const to = from + direction
    if (from < 0 || to < 0 || to >= ordered.length) return

    const next = [...ordered]
    next.splice(to, 0, next.splice(from, 1)[0]!)

    reorderFloors.mutate(next, {
      onError: () => toast.error("Failed to reorder floors"),
    })
  }

  function handleDeleteRoom(roomId: string, number: string) {
    if (!confirm(`Delete room ${number}?`)) return
    deleteRoom.mutate(roomId, {
      onSuccess: () => toast.success("Room deleted"),
      onError: () => toast.error("Failed to delete room"),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/properties/${propertyId}`}
            aria-label="Back to property"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Structure</h1>
            <p className="text-xs text-muted-foreground">
              {property?.name ?? "\u00a0"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFloorDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Floor
          </Button>
          <Button
            size="sm"
            render={<Link href={`/dashboard/properties/${propertyId}/rooms/new`} />}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Room
          </Button>
        </div>
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{totals.floors}</span> floors ·{" "}
          <span className="font-mono text-foreground">{totals.rooms}</span> rooms ·{" "}
          <span className="font-mono text-foreground">{totals.beds}</span> beds
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No floors or rooms yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a floor first if this property has more than one, then add rooms to it.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group, index) => (
            <section key={group.floor?.id ?? "unassigned"}>
              <div className="flex items-center justify-between border-b pb-1.5">
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{group.rooms.length}</span> rooms ·{" "}
                    <span className="font-mono">{group.bedCount}</span> beds
                  </span>
                  {group.floor && (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${group.label} up`}
                        disabled={index === 0 || reorderFloors.isPending}
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleMoveFloor(group.floor!.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${group.label} down`}
                        disabled={
                          index >= totals.floors - 1 || reorderFloors.isPending
                        }
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleMoveFloor(group.floor!.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${group.label}`}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteFloor(group.floor!.id, group.label)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {group.rooms.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">
                  No rooms on this floor yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="w-24 py-1.5 font-medium">Room</th>
                        <th className="py-1.5 font-medium">Type</th>
                        <th className="w-20 py-1.5 text-right font-medium">Beds</th>
                        <th className="w-28 py-1.5 text-right font-medium">Rent</th>
                        <th className="w-10 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.rooms.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 font-mono font-medium">{r.number}</td>
                          <td className="py-2 capitalize text-muted-foreground">
                            {r.type}
                          </td>
                          <td className="py-2 text-right font-mono text-muted-foreground">
                            {r.capacity}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(r.monthlyRent)}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete room ${r.number}`}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteRoom(r.id, r.number)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add floor</DialogTitle>
            <DialogDescription>
              Floors group rooms. Name them the way you refer to them out loud.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={floorName}
            placeholder="Ground floor"
            maxLength={50}
            onChange={(event) => setFloorName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddFloor()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFloorDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!floorName.trim() || createFloor.isPending}
              onClick={handleAddFloor}
            >
              Add floor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
