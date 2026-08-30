"use client"

import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useCreateRoom } from "@/hooks/use-rooms"
import { useFloors } from "@/hooks/use-floors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ApiError } from "@/lib/api-client"

const schema = z.object({
  number: z.string().min(1, "Room number is required").max(20),
  type: z.enum(["single", "double", "triple", "dormitory"]),
  capacity: z.preprocess((v) => Number(v), z.number().min(1).max(20)),
  monthlyRent: z.preprocess((v) => Number(v), z.number().min(0, "Rent must be positive")),
  // "" means unassigned; the API expects null rather than an empty string.
  floorId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewRoomPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.propertyId as string
  const createRoom = useCreateRoom(propertyId)
  const { data: floors } = useFloors(propertyId)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { type: "single", capacity: 1 },
  })

  const roomType = watch("type")

  // Auto-set capacity based on type
  const capacityMap: Record<string, number> = {
    single: 1,
    double: 2,
    triple: 3,
    dormitory: 6,
  }

  function onSubmit(data: FormData) {
    createRoom.mutate(
      { ...data, floorId: data.floorId ? data.floorId : null },
      {
        onSuccess: () => {
          toast.success("Room created")
          router.push(`/dashboard/properties/${propertyId}/rooms`)
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Failed to create room",
          ),
      },
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/properties/${propertyId}/rooms`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Add room</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room number *</label>
          <Input placeholder="101" {...register("number")} />
          {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room type</label>
          <select
            {...register("type")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="triple">Triple</option>
            <option value="dormitory">Dormitory</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Capacity</label>
          <Input
            type="number"
            {...register("capacity")}
            defaultValue={capacityMap[roomType] || 1}
          />
          {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="floorId">
            Floor
          </label>
          <select
            id="floorId"
            {...register("floorId")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">Unassigned</option>
            {floors?.map(({ floor }) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
          {!floors?.length && (
            <p className="text-xs text-muted-foreground">
              No floors yet — the room will be unassigned. You can add floors from
              the structure view.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Monthly rent (₹) *</label>
          <Input type="number" placeholder="8000" {...register("monthlyRent")} />
          {errors.monthlyRent && (
            <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createRoom.isPending}>
            {createRoom.isPending ? "Creating..." : "Create room"}
          </Button>
          <Button type="button" variant="outline" render={<Link href={`/dashboard/properties/${propertyId}/rooms`} />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
