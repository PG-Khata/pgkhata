"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useRooms, useDeleteRoom } from "@/hooks/use-rooms"
import { useProperty } from "@/hooks/use-properties"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"

export default function RoomsPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const { data: property } = useProperty(propertyId)
  const { data: rooms, isLoading } = useRooms(propertyId)
  const deleteRoom = useDeleteRoom(propertyId)

  function handleDelete(roomId: string, number: string) {
    if (!confirm(`Delete room ${number}?`)) return
    deleteRoom.mutate(roomId, {
      onSuccess: () => toast.success("Room deleted"),
      onError: () => toast.error("Failed to delete room"),
    })
  }

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
            <h1 className="text-lg font-semibold">Rooms</h1>
            {property && (
              <p className="text-xs text-muted-foreground">{property.name}</p>
            )}
          </div>
        </div>
        <Button size="sm" render={<Link href={`/dashboard/properties/${propertyId}/rooms/new`} />}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add room
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rooms && rooms.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Room</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Capacity</th>
                <th className="pb-2 font-medium">Rent</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 font-mono font-medium">{r.number}</td>
                  <td className="py-2.5 text-muted-foreground capitalize">{r.type}</td>
                  <td className="py-2.5 text-muted-foreground">{r.capacity}</td>
                  <td className="py-2.5 font-mono">{formatCurrency(r.monthlyRent)}</td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(r.id, r.number)}
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
          <p className="text-sm text-muted-foreground">No rooms yet.</p>
          <Link
            href={`/dashboard/properties/${propertyId}/rooms/new`}
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Add your first room
          </Link>
        </div>
      )}
    </div>
  )
}
