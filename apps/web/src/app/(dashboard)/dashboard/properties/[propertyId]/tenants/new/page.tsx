"use client"

import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useCreateTenant } from "@/hooks/use-tenants"
import { useRooms } from "@/hooks/use-rooms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"),
  roomId: z.string().optional().or(z.literal("")),
  joiningDate: z.string().min(1, "Joining date is required"),
  monthlyRentOverride: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  deposit: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  notes: z.string().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

export default function NewTenantPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.propertyId as string
  const createTenant = useCreateTenant(propertyId)
  const { data: rooms } = useRooms(propertyId)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { joiningDate: new Date().toISOString().split("T")[0] },
  })

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      email: data.email || undefined,
      roomId: data.roomId || undefined,
      notes: data.notes || undefined,
    }
    createTenant.mutate(payload, {
      onSuccess: () => {
        toast.success("Tenant added")
        router.push(`/dashboard/properties/${propertyId}/tenants`)
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to add tenant")
      },
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/properties/${propertyId}/tenants`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Add tenant</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Full name *</label>
          <Input placeholder="Rahul Kumar" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Phone number *</label>
          <Input type="tel" placeholder="9876543210" {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input type="email" placeholder="tenant@email.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room</label>
          <select
            {...register("roomId")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">No room assigned</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} ({r.type}, {r.capacity} bed)
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Joining date *</label>
          <Input type="date" {...register("joiningDate")} />
          {errors.joiningDate && (
            <p className="text-xs text-destructive">{errors.joiningDate.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rent override (₹)</label>
            <Input type="number" placeholder="Room default" {...register("monthlyRentOverride")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Deposit (₹)</label>
            <Input type="number" placeholder="0" {...register("deposit")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <Input placeholder="Optional notes" {...register("notes")} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createTenant.isPending}>
            {createTenant.isPending ? "Adding..." : "Add tenant"}
          </Button>
          <Button type="button" variant="outline" render={<Link href={`/dashboard/properties/${propertyId}/tenants`} />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
