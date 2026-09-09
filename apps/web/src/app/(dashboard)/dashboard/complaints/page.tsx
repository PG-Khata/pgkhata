"use client"

import { useState } from "react"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useComplaints, useUpdateComplaintStatus } from "@/hooks/use-complaints"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { MessageSquare, QrCode, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { ComplaintQrModal } from "@/components/dashboard/complaint-qr-modal"
import type { Complaint } from "@/types"

const STATUS_OPTIONS = [
  { value: "open", label: "Open", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "resolved", label: "Resolved", color: "bg-green-100 text-green-800 border-green-200" },
]

export default function ComplaintsPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id ?? ""
  const { data: complaints, isLoading } = useComplaints(propertyId)
  const [complaintQrOpen, setComplaintQrOpen] = useState(false)

  const openCount = complaints?.filter(c => c.status === "open").length || 0
  const inProgressCount = complaints?.filter(c => c.status === "in_progress").length || 0
  const resolvedCount = complaints?.filter(c => c.status === "resolved").length || 0

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Complaints</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage tenant complaints for this property.
          </p>
        </div>
        {selectedProperty && (
          <Button variant="outline" className="shrink-0" onClick={() => setComplaintQrOpen(true)}>
            <QrCode className="mr-1.5 h-4 w-4" />
            Complaint QR
          </Button>
        )}
      </div>

      {/* Stats */}
      {selectedProperty && complaints && complaints.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-yellow-500" />
              <span className="whitespace-nowrap text-[11px] font-medium leading-none sm:text-sm">Open</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{openCount}</p>
          </div>
          <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="whitespace-nowrap text-[11px] font-medium leading-none sm:text-sm">In progress</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{inProgressCount}</p>
          </div>
          <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
              <span className="whitespace-nowrap text-[11px] font-medium leading-none sm:text-sm">Resolved</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold">{resolvedCount}</p>
          </div>
        </div>
      )}

      {!selectedProperty ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No property selected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the property selector in the header to choose a property.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : complaints && complaints.length > 0 ? (
        <div className="space-y-3">
          {complaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              propertyId={propertyId}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No complaints yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share the Complaint QR code with your tenants to receive complaints.
          </p>
        </div>
      )}

      {selectedProperty && (
        <ComplaintQrModal
          open={complaintQrOpen}
          onOpenChange={setComplaintQrOpen}
          propertyName={selectedProperty.name}
          complaintToken={selectedProperty.complaintToken}
          propertyId={selectedProperty.id}
        />
      )}
    </div>
  )
}

function ComplaintCard({ complaint, propertyId }: { complaint: Complaint; propertyId: string }) {
  const updateStatus = useUpdateComplaintStatus(propertyId)
  const [isUpdating, setIsUpdating] = useState(false)

  const statusOption = STATUS_OPTIONS.find(s => s.value === complaint.status)

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true)
    try {
      await updateStatus.mutateAsync({
        complaintId: complaint.id,
        status: newStatus,
      })
      toast.success(`Complaint marked as ${newStatus.replace("_", " ")}`)
    } catch (error) {
      toast.error("Failed to update complaint status")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="break-words font-medium">{complaint.subject}</h3>
            {complaint.category && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                {complaint.category}
              </span>
            )}
            {complaint.priority && complaint.priority !== "medium" && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                complaint.priority === "urgent" ? "bg-red-100 text-red-800 border-red-200" :
                complaint.priority === "high" ? "bg-orange-100 text-orange-800 border-orange-200" :
                "bg-blue-100 text-blue-800 border-blue-200"
              }`}>
                {complaint.priority}
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${statusOption?.color || "bg-gray-100 text-gray-800"}`}>
              {statusOption?.label || complaint.status}
            </span>
          </div>

          {/* Tenant Info */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {complaint.tenantName && (
              <span className="font-medium">{complaint.tenantName}</span>
            )}
            {complaint.tenantPhone && (
              <a href={`tel:${complaint.tenantPhone}`} className="text-emerald-600 hover:underline">
                {complaint.tenantPhone}
              </a>
            )}
            {complaint.tenantEmail && (
              <a href={`mailto:${complaint.tenantEmail}`} className="max-w-full break-all text-muted-foreground hover:underline">
                {complaint.tenantEmail}
              </a>
            )}
          </div>

          {complaint.roomNumber && (
            <p className="mt-1 text-sm text-muted-foreground">
              Room: {complaint.roomNumber}
            </p>
          )}
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {complaint.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Submitted: {formatDate(complaint.createdAt)}
          </p>
        </div>

        {/* Status Update Buttons */}
        <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
          {complaint.status === "open" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("in_progress")}
                disabled={isUpdating}
                className="h-10 flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 sm:h-7 sm:flex-none"
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                In Progress
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("resolved")}
                disabled={isUpdating}
                className="h-10 flex-1 text-green-600 border-green-200 hover:bg-green-50 sm:h-7 sm:flex-none"
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Resolved
              </Button>
            </>
          )}
          {complaint.status === "in_progress" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("resolved")}
              disabled={isUpdating}
              className="h-10 flex-1 text-green-600 border-green-200 hover:bg-green-50 sm:h-7 sm:flex-none"
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              Resolved
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
