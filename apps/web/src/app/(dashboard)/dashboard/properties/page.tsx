"use client"

import Link from "next/link"
import { useProperties } from "@/hooks/use-properties"
import { useDeleteProperty } from "@/hooks/use-properties"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

export default function PropertiesPage() {
  const { data: properties, isLoading } = useProperties()
  const deleteProperty = useDeleteProperty()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteProperty.mutate(id, {
      onSuccess: () => toast.success("Property deleted"),
      onError: () => toast.error("Failed to delete property"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Properties</h1>
        <Button size="sm" render={<Link href="/dashboard/properties/new" />}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add property
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Address</th>
                <th className="pb-2 font-medium">City</th>
                <th className="pb-2 font-medium">Electricity</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2.5">
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{p.address || "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{p.city || "—"}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.electricityMode === "meter"
                      ? `₹${p.electricityRatePerUnit}/unit`
                      : "Flat"}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(p.id, p.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No properties yet.</p>
          <Link
            href="/dashboard/properties/new"
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            Add your first property
          </Link>
        </div>
      )}
    </div>
  )
}
