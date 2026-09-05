"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import { Plus, Pencil, Trash2, ClipboardList } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

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
  const { selectedProperty, setSelectedProperty } = useSelectedProperty()

  if (!selectedProperty) {
    return <PropertySelector />
  }

  return <RentPlansContent propertyId={selectedProperty.id} propertyName={selectedProperty.name} />
}

function PropertySelector() {
  const { setSelectedProperty } = useSelectedProperty()
  const { data: properties, isLoading } = useProperties()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Rent plans</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Select a property to manage rent plans.</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="space-y-2">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProperty(p)}
              className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">View plans</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No properties</p>
        </div>
      )}
    </div>
  )
}

function RentPlansContent({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { data: plans, isLoading } = useRentPlans(propertyId)
  const createPlan = useCreateRentPlan(propertyId)
  const updatePlan = useUpdateRentPlan(propertyId)
  const deletePlan = useDeleteRentPlan(propertyId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; roomCount: number } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { dueDay: 1 },
  })

  function onSubmit(data: FormData) {
    if (editTarget) {
      updatePlan.mutate(
        { planId: editTarget.id, ...data },
        {
          onSuccess: () => {
            toast.success(`${data.name} updated`)
            reset()
            setEditTarget(null)
            setDialogOpen(false)
          },
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.message : "Failed to update plan"),
        },
      )
    } else {
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
  }

  function openEdit(plan: any) {
    setEditTarget(plan)
    reset({
      name: plan.name,
      monthlyRent: plan.monthlyRent,
      securityDeposit: plan.securityDeposit ?? undefined,
      dueDay: plan.dueDay,
      lateFeePerDay: plan.lateFeePerDay ?? undefined,
    })
    setDialogOpen(true)
  }

  function handleToggleActive(planId: string, isActive: boolean, name: string) {
    updatePlan.mutate(
      { planId, isActive: !isActive },
      {
        onSuccess: () => toast.success(`${name} ${!isActive ? "activated" : "deactivated"}`),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      },
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.roomCount > 0) {
      toast.error(`${deleteTarget.name} is used by ${deleteTarget.roomCount} room${deleteTarget.roomCount === 1 ? "" : "s"}`)
      setDeleteTarget(null)
      return
    }
    deletePlan.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} deleted`)
        setDeleteTarget(null)
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Rent plans</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configurable pricing for {propertyName} — rent, deposit, due day, and late fee.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add plan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : plans && plans.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">NAME</th>
                  <th className="px-3 py-2.5 font-medium text-right">RENT</th>
                  <th className="px-3 py-2.5 font-medium text-right">DEPOSIT</th>
                  <th className="px-3 py-2.5 font-medium text-right">DUE DAY</th>
                  <th className="px-3 py-2.5 font-medium text-right">LATE FEE/DAY</th>
                  <th className="px-3 py-2.5 font-medium text-right">ROOMS</th>
                  <th className="px-3 py-2.5 font-medium">STATUS</th>
                  <th className="px-3 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map(({ plan, roomCount }) => (
                  <tr key={plan.id} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">{plan.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(plan.monthlyRent)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {plan.securityDeposit ? formatCurrency(plan.securityDeposit) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{plan.dueDay}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {plan.lateFeePerDay ? formatCurrency(plan.lateFeePerDay) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{roomCount}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleToggleActive(plan.id, plan.isActive, plan.name)}
                        className="cursor-pointer"
                      >
                        <StatusBadge status={plan.isActive ? "active" : "inactive"} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => openEdit(plan)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: plan.id, name: plan.name, roomCount })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {plans.map(({ plan, roomCount }) => (
              <div key={plan.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{plan.name}</span>
                  <button
                    onClick={() => handleToggleActive(plan.id, plan.isActive, plan.name)}
                    className="cursor-pointer"
                  >
                    <StatusBadge status={plan.isActive ? "active" : "inactive"} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Rent</p>
                    <p className="font-mono">{formatCurrency(plan.monthlyRent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deposit</p>
                    <p className="font-mono text-muted-foreground">{plan.securityDeposit ? formatCurrency(plan.securityDeposit) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due day</p>
                    <p className="font-mono text-muted-foreground">{plan.dueDay}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Late fee/day</p>
                    <p className="font-mono text-muted-foreground">{plan.lateFeePerDay ? formatCurrency(plan.lateFeePerDay) : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => openEdit(plan)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget({ id: plan.id, name: plan.name, roomCount })}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No rent plans yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a rent plan to define pricing for your rooms.
          </p>
        </div>
      )}

      {/* Add plan dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit rent plan" : "Add rent plan"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update the plan details." : "Attach this plan to any room. A tenant's own override still wins over it."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
              <Input placeholder="Single AC, Double Sharing..." {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Monthly rent (₹) <span className="text-destructive">*</span></label>
                <Input type="number" placeholder="8000" {...register("monthlyRent")} />
                {errors.monthlyRent && <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Security deposit (₹)</label>
                <Input type="number" placeholder="4000" {...register("securityDeposit")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due day <span className="text-destructive">*</span></label>
                <Input type="number" min={1} max={28} {...register("dueDay")} />
                {errors.dueDay && <p className="text-xs text-destructive">{errors.dueDay.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Late fee/day (₹)</label>
                <Input type="number" placeholder="100" {...register("lateFeePerDay")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => { reset(); setEditTarget(null); setDialogOpen(false) }}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createPlan.isPending || updatePlan.isPending}>
                {(createPlan.isPending || updatePlan.isPending) ? "Saving..." : editTarget ? "Save" : "Add plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete rent plan"
        description={`Delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deletePlan.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
