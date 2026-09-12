"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useCreateRoom } from "@/hooks/use-rooms"
import { useFloors } from "@/hooks/use-floors"
import { useRentPlans } from "@/hooks/use-rent-plans"
import { useSelectedProperty } from "@/components/layout/property-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/utils"

const schema = z
  .object({
    number: z.string().min(1, "Room number is required").max(20),
    type: z.enum(["single", "double", "triple", "dormitory"]),
    capacity: z.preprocess((v) => Number(v), z.number().min(1).max(20)),
    // Optional here: when a rent plan is attached the plan governs the rent, so
    // the field is hidden and this stays empty. resolveMonthlyRent (api) only
    // falls back to room rent when no plan/bed/tenant override applies.
    monthlyRent: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().min(0, "Rent must be positive").optional(),
    ),
    // "" means unassigned; the API expects null rather than an empty string.
    floorId: z.string().optional(),
    rentPlanId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Rent is only required when the room isn't priced under a plan.
    if (!data.rentPlanId && data.monthlyRent === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyRent"],
        message: "Monthly rent is required",
      })
    }
  })

type FormData = z.infer<typeof schema>
type FormInput = z.input<typeof schema>

// Default bed count per room type. Selecting a type pre-fills capacity; the user
// can still override it afterwards.
const capacityMap: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  dormitory: 6,
}

export default function NewRoomPage() {
  const router = useRouter()
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""
  const createRoom = useCreateRoom(propertyId)
  const { data: floors } = useFloors(propertyId)
  const { data: plans } = useRentPlans(propertyId)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "single", capacity: 1 },
  })

  const roomType = watch("type")
  const selectedPlanId = watch("rentPlanId")
  const selectedPlan = plans?.find(({ plan }) => plan.id === selectedPlanId)?.plan

  // Pre-fill capacity when the room type changes. `defaultValue` on a registered
  // input is ignored after mount, so drive the value through setValue instead.
  // Only fires on a type change, leaving any manual override intact until then.
  useEffect(() => {
    setValue("capacity", capacityMap[roomType] ?? 1)
  }, [roomType, setValue])

  function onSubmit(data: FormData) {
    // The API always stores a room rent as the last-resort fallback. When a plan
    // is attached the field is hidden, so seed the fallback from the plan's rent
    // — that way the room keeps a sensible rent if the plan is detached later.
    const monthlyRent = data.rentPlanId
      ? (selectedPlan?.monthlyRent ?? 0)
      : (data.monthlyRent ?? 0)

    createRoom.mutate(
      {
        ...data,
        monthlyRent,
        floorId: data.floorId ? data.floorId : null,
        rentPlanId: data.rentPlanId ? data.rentPlanId : null,
      },
      {
        onSuccess: () => {
          toast.success("Room created")
          router.push("/dashboard/structure")
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
          href="/dashboard/structure"
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
          <label className="text-sm font-medium" htmlFor="rentPlanId">
            Rent plan
          </label>
          <select
            id="rentPlanId"
            {...register("rentPlanId")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">None — use the rent below</option>
            {plans?.map(({ plan }) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({formatCurrency(plan.monthlyRent)})
              </option>
            ))}
          </select>
        </div>

        {selectedPlan ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Effective rent</label>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
              <span className="font-mono">{formatCurrency(selectedPlan.monthlyRent)}</span>
              <span className="text-muted-foreground"> / mo · from “{selectedPlan.name}”</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The plan sets the rent for this room. Pick “None” above to enter a
              rent directly.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Monthly rent (₹) *</label>
            <Input type="number" placeholder="8000" {...register("monthlyRent")} />
            {errors.monthlyRent && (
              <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Charged when no rent plan is attached to the room.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createRoom.isPending}>
            {createRoom.isPending ? "Creating..." : "Create room"}
          </Button>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/structure" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
