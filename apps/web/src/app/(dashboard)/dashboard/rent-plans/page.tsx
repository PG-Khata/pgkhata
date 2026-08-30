"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { useProperties } from "@/hooks/use-properties"
import {
  useRentPlans,
  useCreateRentPlan,
  useUpdateRentPlan,
  useDeleteRentPlan,
} from "@/hooks/use-rent-plans"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/dashboard/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { ApiError } from "@/lib/api-client"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  monthlyRent: z.preprocess((v) => Number(v), z.number().min(0, "Rent must be positive")),
  securityDeposit: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  dueDay: z.preprocess((v) => Number(v), z.number().min(1).max(28)),
  lateFeePerDay: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
})

type FormData = z.infer<typeof schema>

export default function RentPlansPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: plans, isLoading } = useRentPlans(propertyId)
  const createPlan = useCreateRentPlan(propertyId)
  const updatePlan = useUpdateRentPlan(propertyId)
  const deletePlan = useDeleteRentPlan(propertyId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { dueDay: 1 },
  })

  const activeProperty = propertyId || properties?.[0]?.id || ""

  function onSubmit(data: FormData) {
    createPlan.mutate(data, {
      onSuccess: () => {
        toast.success(`${data.name} added`)
        reset()
        setDialogOpen(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to create plan"),
    })
  }

  function handleToggleActive(planId: string, isActive: boolean, name: string) {
    updatePlan.mutate(
      { planId, isActive: !isActive },
      {
        onSuccess: () =>
          toast.success(`${name} ${!isActive ? "activated" : "deactivated"}`),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to update plan"),
      },
    )
  }

  function handleDelete(planId: string, name: string, roomCount: number) {
    if (roomCount > 0) {
      toast.error(`${name} is used by ${roomCount} room${roomCount === 1 ? "" : "s"}`)
      return
    }
    if (!confirm(`Delete ${name}?`)) return

    deletePlan.mutate(planId, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to delete plan"),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Rent plans</h1>
          <p className="text-xs text-muted-foreground">
            Configurable pricing an owner attaches to rooms — rent, deposit, due
            day, and late fee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {properties && properties.length > 1 && (
            <select
              value={activeProperty}
              onChange={(event) => setPropertyId(event.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!activeProperty}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Plan
          </Button>
        </div>
      </div>

      {propertiesLoading || isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !activeProperty ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Add a property first.</p>
        </div>
      ) : !plans || plans.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No rent plans yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 text-right font-medium">Rent</th>
                <th className="pb-2 text-right font-medium">Deposit</th>
                <th className="pb-2 text-right font-medium">Due day</th>
                <th className="pb-2 text-right font-medium">Late fee/day</th>
                <th className="pb-2 text-right font-medium">Rooms</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {plans.map(({ plan, roomCount }) => (
                <tr key={plan.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 font-medium">{plan.name}</td>
                  <td className="py-2.5 text-right font-mono">
                    {formatCurrency(plan.monthlyRent)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground">
                    {plan.securityDeposit ? formatCurrency(plan.securityDeposit) : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground">
                    {plan.dueDay}
                  </td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground">
                    {plan.lateFeePerDay ? formatCurrency(plan.lateFeePerDay) : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground">
                    {roomCount}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleToggleActive(plan.id, plan.isActive, plan.name)}
                      className="cursor-pointer"
                    >
                      <StatusBadge status={plan.isActive ? "active" : "vacated"} />
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${plan.name}`}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(plan.id, plan.name, roomCount)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add rent plan</DialogTitle>
            <DialogDescription>
              Attach this plan to any room. A tenant's own override still wins
              over it.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input placeholder="Standard" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Monthly rent (₹) *</label>
                <Input type="number" placeholder="6500" {...register("monthlyRent")} />
                {errors.monthlyRent && (
                  <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Security deposit (₹)</label>
                <Input type="number" placeholder="13000" {...register("securityDeposit")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due day *</label>
                <Input type="number" min={1} max={28} {...register("dueDay")} />
                {errors.dueDay && (
                  <p className="text-xs text-destructive">{errors.dueDay.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Late fee/day (₹)</label>
                <Input type="number" placeholder="50" {...register("lateFeePerDay")} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createPlan.isPending}>
                Add plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
