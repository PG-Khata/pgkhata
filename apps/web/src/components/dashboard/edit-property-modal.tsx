"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useUpdateProperty } from "@/hooks/use-properties"
import type { Property } from "@/types"
import { ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().max(20).optional(),
  address: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  description: z.string().optional(),
  upiVpa: z.string().max(100).optional(),
})

type FormData = z.infer<typeof schema>

interface EditPropertyModalProps {
  property: Property | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPropertyModal({ property, open, onOpenChange }: EditPropertyModalProps) {
  const updateProperty = useUpdateProperty(property?.id ?? "")
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    if (!property) return
    reset({
      name: property.name,
      code: property.code ?? "",
      address: property.address ?? "",
      landmark: property.landmark ?? "",
      city: property.city ?? "",
      state: property.state ?? "",
      pincode: property.pincode ?? "",
      latitude: property.latitude ?? "",
      longitude: property.longitude ?? "",
      description: property.description ?? "",
      upiVpa: property.upiVpa ?? "",
    })
  }, [property, reset])

  function onSubmit(data: FormData) {
    if (!property) return
    updateProperty.mutate(data, {
      onSuccess: () => {
        toast.success("Property updated")
        onOpenChange(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to update property"),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>Update this PG or hostel’s details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Basics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Property name</label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Code</label>
                <Input {...register("code")} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Address</label>
              <Input {...register("address")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Landmark</label>
              <Input {...register("landmark")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><label className="text-sm font-medium">City</label><Input {...register("city")} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">State</label><Input {...register("state")} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Pincode</label><Input {...register("pincode")} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-sm font-medium">Latitude</label><Input {...register("latitude")} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Longitude</label><Input {...register("longitude")} /></div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea rows={3} {...register("description")} />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">UPI ID (VPA)</label>
              <Input {...register("upiVpa")} placeholder="yourname@upi" />
              <p className="text-xs text-muted-foreground">Used in WhatsApp bill notifications for UPI payments.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={updateProperty.isPending}>
              {updateProperty.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
