"use client"

import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "@/hooks/use-notifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import {
  Bell,
  CheckCheck,
  CreditCard,
  UserCheck,
  UserMinus,
  CalendarClock,
  BookOpen,
  ArrowRight,
} from "lucide-react"

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  payment_received: { icon: CreditCard, color: "bg-emerald-100 text-emerald-700" },
  tenant_checkin: { icon: UserCheck, color: "bg-blue-100 text-blue-700" },
  tenant_checkout: { icon: UserMinus, color: "bg-red-100 text-red-700" },
  rent_due: { icon: CalendarClock, color: "bg-amber-100 text-amber-700" },
  booking_created: { icon: BookOpen, color: "bg-purple-100 text-purple-700" },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationsPage() {
  const { selectedProperty } = useSelectedProperty()
  const propertyId = selectedProperty?.id

  const { data: notifications, isLoading } = useNotifications(propertyId)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  function handleMarkAll() {
    markAllAsRead.mutate(propertyId, {
      onSuccess: () => toast.success("All marked as read"),
    })
  }

  function handleClick(n: { id: string; read: boolean; link?: string | null }) {
    if (!n.read) {
      markAsRead.mutate(n.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rent, payment, and tenant updates for the properties you manage.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAll}>
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-1">
          {notifications.map((n) => {
            const config = typeConfig[n.type] || { icon: Bell, color: "bg-zinc-100 text-zinc-700" }
            const Icon = config.icon
            return (
              <div
                key={n.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/30 ${
                  !n.read ? "bg-muted/20" : ""
                }`}
                onClick={() => handleClick(n)}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
                {n.link && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You'll see rent, payment, and tenant updates here.
          </p>
        </div>
      )}
    </div>
  )
}
