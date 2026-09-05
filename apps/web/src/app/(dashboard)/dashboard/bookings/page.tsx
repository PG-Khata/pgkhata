"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useBookings, useCreateBooking, useCancelBooking, useConvertBooking, useUpdateBooking, useDeleteBooking } from "@/hooks/use-bookings"
import { useBeds } from "@/hooks/use-beds"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import {
  Bed,
  CalendarDays,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export default function BookingsPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""

  const { data: bookings, isLoading } = useBookings(propertyId)
  const { data: beds } = useBeds(propertyId)
  const createBooking = useCreateBooking(propertyId)
  const cancelBooking = useCancelBooking(propertyId)
  const convertBooking = useConvertBooking(propertyId)
  const updateBooking = useUpdateBooking(propertyId)
  const deleteBooking = useDeleteBooking(propertyId)

  const [statusFilter, setStatusFilter] = useState<string>("active")
  const [reserveOpen, setReserveOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<any>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "delete"; id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    bedId: "",
    tenantName: "",
    tenantPhone: "",
    expiryDays: "7",
    notes: "",
  })

  const vacantBeds = (beds ?? []).filter((b) => b.bed.status === "vacant")

  const filtered = (bookings ?? []).filter((b) => {
    if (statusFilter === "all") return true
    if (statusFilter === "active") return b.status === "pending" || b.status === "confirmed"
    return b.status === statusFilter
  })

  function handleReserve() {
    if (!form.bedId || !form.tenantName || !form.tenantPhone) {
      toast.error("Fill in all required fields")
      return
    }
    createBooking.mutate(
      {
        bedId: form.bedId,
        tenantName: form.tenantName,
        tenantPhone: form.tenantPhone,
        expiryDays: Number(form.expiryDays) || 7,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Bed reserved")
          setForm({ bedId: "", tenantName: "", tenantPhone: "", expiryDays: "7", notes: "" })
          setReserveOpen(false)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to reserve bed"),
      },
    )
  }

  function handleCancel(id: string, name: string) {
    setConfirmAction({ type: "cancel", id, name })
  }

  function handleConvert(id: string) {
    convertBooking.mutate(id, {
      onSuccess: () => toast.success("Booking converted to tenant"),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to convert"),
    })
  }

  function handleDelete(id: string, name: string) {
    setConfirmAction({ type: "delete", id, name })
  }

  function executeConfirm() {
    if (!confirmAction) return
    if (confirmAction.type === "cancel") {
      cancelBooking.mutate(confirmAction.id, {
        onSuccess: () => { toast.success("Booking cancelled"); setConfirmAction(null) },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      })
    } else {
      deleteBooking.mutate(confirmAction.id, {
        onSuccess: () => { toast.success("Booking deleted"); setConfirmAction(null) },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed"),
      })
    }
  }

  function openEdit(b: any) {
    setEditBooking(b)
  }

  function handleEditSave() {
    if (!editBooking) return
    updateBooking.mutate(
      {
        bookingId: editBooking.id,
        data: {
          tenantName: editBooking.tenantName,
          tenantPhone: editBooking.tenantPhone,
          notes: editBooking.notes,
        },
      },
      {
        onSuccess: () => {
          toast.success("Booking updated")
          setEditBooking(null)
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Failed to update"),
      },
    )
  }

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Bookings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a property from the header to view bookings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Bookings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Beds reserved for prospective tenants ahead of check-in. Collect advance against a booking, then convert it once the tenant moves in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="converted">Converted</option>
          </select>
          <Button size="sm" onClick={() => setReserveOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Reserve bed
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-transparent to-black/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">TENANT</th>
                  <th className="px-4 py-3 font-medium">BED / ROOM</th>
                  <th className="px-4 py-3 font-medium">BOOKED</th>
                  <th className="px-4 py-3 font-medium">EXPIRES</th>
                  <th className="px-4 py-3 font-medium">STATUS</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr
                    key={b.id || i}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.tenantName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{b.tenantPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.roomNumber && b.bedNumber
                        ? `Room ${b.roomNumber} · Bed ${b.bedNumber}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.bookingDate ? formatDateShort(b.bookingDate) : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.expiryDate ? formatDateShort(b.expiryDate) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status === "confirmed" ? "approved" : b.status === "converted" ? "active" : b.status === "cancelled" ? "rejected" : "pending"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(b.status === "pending" || b.status === "confirmed") && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-700 hover:text-emerald-800"
                              onClick={() => handleConvert(b.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Convert
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openEdit(b)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleCancel(b.id, b.tenantName)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Cancel
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(b.id, b.tenantName)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>Showing 1-{filtered.length} of {filtered.length}</span>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((b, i) => (
              <div key={b.id || i} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.tenantName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{b.tenantPhone}</p>
                  </div>
                  <StatusBadge status={b.status === "confirmed" ? "approved" : b.status === "converted" ? "active" : b.status === "cancelled" ? "rejected" : "pending"} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Bed / Room</p>
                    <p>{b.roomNumber && b.bedNumber ? `Room ${b.roomNumber} · Bed ${b.bedNumber}` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p>{b.expiryDate ? formatDateShort(b.expiryDate) : "-"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(b.status === "pending" || b.status === "confirmed") && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-emerald-700 hover:text-emerald-800"
                        onClick={() => handleConvert(b.id)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Convert
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => openEdit(b)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-destructive hover:text-destructive"
                        onClick={() => handleCancel(b.id, b.tenantName)}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(b.id, b.tenantName)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Bed className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No bookings</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reserve a bed for a prospective tenant to hold it ahead of check-in.
          </p>
        </div>
      )}

      {/* Reserve bed dialog */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reserve bed</DialogTitle>
            <DialogDescription>
              Hold a bed for a prospective tenant. The bed will be marked as reserved until the booking expires or is converted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bed <span className="text-destructive">*</span></label>
              <select
                value={form.bedId}
                onChange={(e) => setForm({ ...form, bedId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a vacant bed</option>
                {vacantBeds.map((b) => (
                  <option key={b.bed.id} value={b.bed.id}>
                    Room {b.roomNumber} · Bed {b.bed.number}
                    {b.floorName ? ` (${b.floorName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tenant name <span className="text-destructive">*</span></label>
                <Input
                  value={form.tenantName}
                  onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                  placeholder="Prospective tenant"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone <span className="text-destructive">*</span></label>
                <Input
                  value={form.tenantPhone}
                  onChange={(e) => setForm({ ...form, tenantPhone: e.target.value })}
                  placeholder="9876543210"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Expiry (days)</label>
              <Input
                type="number"
                value={form.expiryDays}
                onChange={(e) => setForm({ ...form, expiryDays: e.target.value })}
                placeholder="7"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setForm({ bedId: "", tenantName: "", tenantPhone: "", expiryDays: "7", notes: "" })
                setReserveOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleReserve} disabled={createBooking.isPending}>
              {createBooking.isPending ? "Reserving..." : "Reserve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit booking dialog */}
      <Dialog open={!!editBooking} onOpenChange={() => setEditBooking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit booking</DialogTitle>
            <DialogDescription>Update booking details.</DialogDescription>
          </DialogHeader>
          {editBooking && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tenant name</label>
                <Input
                  value={editBooking.tenantName}
                  onChange={(e) => setEditBooking({ ...editBooking, tenantName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editBooking.tenantPhone}
                  onChange={(e) => setEditBooking({ ...editBooking, tenantPhone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={editBooking.notes || ""}
                  onChange={(e) => setEditBooking({ ...editBooking, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditBooking(null)}>Cancel</Button>
            <Button size="sm" onClick={handleEditSave} disabled={updateBooking.isPending}>
              {updateBooking.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction?.type === "delete" ? "Delete booking" : "Cancel booking"}
        description={
          confirmAction?.type === "delete"
            ? `Delete ${confirmAction?.name}'s booking? The bed will be released. This cannot be undone.`
            : `Cancel ${confirmAction?.name}'s booking? The bed will be released.`
        }
        confirmLabel={confirmAction?.type === "delete" ? "Delete" : "Cancel booking"}
        variant="destructive"
        loading={cancelBooking.isPending || deleteBooking.isPending}
        onConfirm={executeConfirm}
      />
    </div>
  )
}
