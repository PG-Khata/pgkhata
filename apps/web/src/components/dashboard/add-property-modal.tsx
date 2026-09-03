"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useCreateProperty } from "@/hooks/use-properties"
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
import { ApiError } from "@/lib/api-client"

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

interface AddPropertyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPropertyModal({ open, onOpenChange }: AddPropertyModalProps) {
  const createProperty = useCreateProperty()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  function onSubmit(data: FormData) {
    createProperty.mutate(
      { ...data, electricityMode: "flat" },
      {
        onSuccess: () => {
          toast.success("Property created")
          reset()
          onOpenChange(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to create property"),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new property</DialogTitle>
          <DialogDescription>Set up a new PG or hostel property.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Basics */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Basics
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Property name</label>
                  <Input placeholder="NCR PG, Sector 59" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Code</label>
                  <Input placeholder="NCR" {...register("code")} />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Location
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <Input placeholder="Street / locality" {...register("address")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Landmark</label>
                <Input placeholder="Near City Mall (optional)" {...register("landmark")} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">City</label>
                  <Input placeholder="Noida" {...register("city")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">State</label>
                  <Input placeholder="UP" {...register("state")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Pincode</label>
                  <Input placeholder="201301" {...register("pincode")} />
                </div>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Coordinates (optional)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Latitude</label>
                <Input {...register("latitude")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Longitude</label>
                <Input {...register("longitude")} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional notes about this property"
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Payment */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payment
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">UPI ID (VPA)</label>
              <Input placeholder="yourname@upi" {...register("upiVpa")} />
              <p className="text-xs text-muted-foreground">Used in WhatsApp bill notifications for UPI payments.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createProperty.isPending}>
              {createProperty.isPending ? "Creating..." : "Create property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
