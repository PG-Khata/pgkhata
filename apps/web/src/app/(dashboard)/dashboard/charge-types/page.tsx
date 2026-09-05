"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { useProperties } from "@/hooks/use-properties"
import {
  useChargeTypes,
  useCreateChargeType,
  useUpdateChargeType,
  useDeleteChargeType,
} from "@/hooks/use-charge-types"
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
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only"),
  defaultAmount: z.preprocess((v) => Number(v) || 0, z.number().min(0)),
  isRecurring: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

export default function ChargeTypesPage() {
  const { data: properties, isLoading: propertiesLoading } = useProperties()
  const [propertyId, setPropertyId] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const activeProperty = propertyId || properties?.[0]?.id || ""
  const { data: types, isLoading } = useChargeTypes(activeProperty)
  const createType = useCreateChargeType(activeProperty)
  const updateType = useUpdateChargeType(activeProperty)
  const deleteType = useDeleteChargeType(activeProperty)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { isRecurring: true },
  })

  function onSubmit(data: FormData) {
    createType.mutate(data, {
      onSuccess: () => {
        toast.success(`${data.name} added`)
        reset()
        setDialogOpen(false)
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to create charge type"),
    })
  }

  function handleToggleActive(type: { id: string; isActive: boolean; name: string; code: string }) {
    updateType.mutate(
      { id: type.id, isActive: !type.isActive },
      {
        onSuccess: () =>
          toast.success(`${type.name} ${!type.isActive ? "activated" : "deactivated"}`),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Failed to update charge type",
          ),
      },
    )
  }

  function handleDelete(id: string, name: string, code: string) {
    if (code === "ELEC") {
      toast.error("The electricity charge type cannot be deleted")
      return
    }
    if (!confirm(`Delete ${name}?`)) return

    deleteType.mutate(id, {
      onSuccess: () => toast.success(`${name} deleted`),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to delete charge type"),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Charge types</h1>
          <p className="text-xs text-muted-foreground">
            Bills can include any of these as a separate line, alongside rent.
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
            Charge type
          </Button>
        </div>
      </div>

      {propertiesLoading || isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !activeProperty ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Add a property first.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 text-right font-medium">Default amount</th>
                  <th className="pb-2 font-medium">Recurring</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {types?.map((type) => (
                  <tr key={type.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 font-medium">{type.name}</td>
                    <td className="py-2.5 font-mono text-muted-foreground">{type.code}</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatCurrency(type.defaultAmount)}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {type.isRecurring ? "Yes" : "One-off"}
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => handleToggleActive(type)}
                        disabled={type.code === "ELEC"}
                        className="cursor-pointer disabled:cursor-not-allowed"
                        title={type.code === "ELEC" ? "Electricity cannot be deactivated" : undefined}
                      >
                        <StatusBadge status={type.isActive ? "active" : "vacated"} />
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${type.name}`}
                        disabled={type.code === "ELEC"}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
                        onClick={() => handleDelete(type.id, type.name, type.code)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {types?.map((type) => (
              <div key={type.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{type.name}</span>
                    <span className="ml-2 text-xs font-mono text-muted-foreground">{type.code}</span>
                  </div>
                  <button
                    onClick={() => handleToggleActive(type)}
                    disabled={type.code === "ELEC"}
                    className="cursor-pointer disabled:cursor-not-allowed"
                    title={type.code === "ELEC" ? "Electricity cannot be deactivated" : undefined}
                  >
                    <StatusBadge status={type.isActive ? "active" : "vacated"} />
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{type.isRecurring ? "Recurring" : "One-off"}</span>
                  <span className="font-mono">{formatCurrency(type.defaultAmount)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-destructive hover:text-destructive"
                  disabled={type.code === "ELEC"}
                  onClick={() => handleDelete(type.id, type.name, type.code)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add charge type</DialogTitle>
            <DialogDescription>
              A short code identifies it on bills — WATER, MAINT, and so on.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input placeholder="Water" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Code *</label>
              <Input placeholder="WATER" {...register("code")} />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Default amount (₹)</label>
              <Input type="number" placeholder="200" {...register("defaultAmount")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isRecurring")} defaultChecked />
              Recurring — appears on every monthly bill
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createType.isPending}>
                Add charge type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
