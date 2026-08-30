"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useRooms } from "@/hooks/use-rooms"
import { useProperty } from "@/hooks/use-properties"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowLeft, Plus } from "lucide-react"
import type { ElectricityReading } from "@/types"

export default function ReadingsPage() {
  const params = useParams()
  const propertyId = params.propertyId as string
  const qc = useQueryClient()

  const { data: property } = useProperty(propertyId)
  const { data: rooms } = useRooms(propertyId)
  const [selectedRoom, setSelectedRoom] = useState("")

  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings", propertyId, selectedRoom],
    queryFn: () =>
      api.get<ElectricityReading[]>(
        `/v1/properties/${propertyId}/readings?roomId=${selectedRoom}`,
      ),
    enabled: !!propertyId && !!selectedRoom,
  })

  const [form, setForm] = useState({
    reading: "",
    readingDate: new Date().toISOString().split("T")[0],
  })

  const addReading = useMutation({
    mutationFn: () =>
      api.post(`/v1/properties/${propertyId}/readings`, {
        roomId: selectedRoom,
        reading: Number(form.reading),
        readingDate: form.readingDate,
      }),
    onSuccess: () => {
      toast.success("Reading added")
      setForm({ reading: "", readingDate: new Date().toISOString().split("T")[0] })
      qc.invalidateQueries({ queryKey: ["readings", propertyId, selectedRoom] })
    },
    onError: () => toast.error("Failed to add reading"),
  })

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
          <h1 className="text-lg font-semibold">Electricity Readings</h1>
          {property && (
            <p className="text-xs text-muted-foreground">{property.name}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">Select room</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </div>

        {selectedRoom && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meter reading</label>
              <Input
                type="number"
                value={form.reading}
                onChange={(e) => setForm({ ...form, reading: e.target.value })}
                placeholder="12345"
                className="w-32"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={form.readingDate}
                onChange={(e) => setForm({ ...form, readingDate: e.target.value })}
                className="w-40"
              />
            </div>
            <Button
              size="sm"
              onClick={() => addReading.mutate()}
              disabled={!form.reading || addReading.isPending}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {addReading.isPending ? "Adding..." : "Add"}
            </Button>
          </>
        )}
      </div>

      {!selectedRoom ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Select a room to view readings.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : readings && readings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Reading</th>
                <th className="pb-2 font-medium text-right">Units</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2.5 text-muted-foreground">{formatDate(r.readingDate)}</td>
                  <td className="py-2.5 text-right font-mono">{r.reading}</td>
                  <td className="py-2.5 text-right font-mono">{r.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No readings for this room.</p>
        </div>
      )}
    </div>
  )
}
