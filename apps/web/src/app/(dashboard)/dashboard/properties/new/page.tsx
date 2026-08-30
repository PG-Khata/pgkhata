"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useCreateProperty } from "@/hooks/use-properties"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  electricityMode: z.enum(["flat", "meter"]),
  electricityRatePerUnit: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
})

type FormData = z.infer<typeof schema>

export default function NewPropertyPage() {
  const router = useRouter()
  const createProperty = useCreateProperty()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { electricityMode: "flat" },
  })

  const electricityMode = watch("electricityMode")

  function onSubmit(data: FormData) {
    createProperty.mutate(data, {
      onSuccess: () => {
        toast.success("Property created")
        router.push("/dashboard/properties")
      },
      onError: () => toast.error("Failed to create property"),
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/properties" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Add property</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Property name *</label>
          <Input placeholder="Sunrise PG" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Address</label>
          <Input placeholder="123 MG Road" {...register("address")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">City</label>
            <Input placeholder="Bangalore" {...register("city")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">State</label>
            <Input placeholder="Karnataka" {...register("state")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Pincode</label>
          <Input placeholder="560001" {...register("pincode")} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Electricity billing</label>
          <select
            {...register("electricityMode")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="flat">Flat rate</option>
            <option value="meter">Per unit (metered)</option>
          </select>
        </div>

        {electricityMode === "meter" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rate per unit (₹)</label>
            <Input
              type="number"
              placeholder="8"
              {...register("electricityRatePerUnit")}
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createProperty.isPending}>
            {createProperty.isPending ? "Creating..." : "Create property"}
          </Button>
          <Button type="button" variant="outline" render={<Link href="/dashboard/properties" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
