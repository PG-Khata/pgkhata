"use client"

import { useSession } from "@/lib/auth-client"
import { signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  LogOut,
  Mail,
  User,
  Shield,
  CalendarDays,
} from "lucide-react"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function ProfilePage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-6">
          <Skeleton className="h-32 w-32 rounded-xl" />
          <Skeleton className="h-32 flex-1 rounded-xl" />
        </div>
      </div>
    )
  }

  const user = session?.user

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your account details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Profile card */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
            <p className="mt-4 text-lg font-semibold">{user?.name || "User"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Owner</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border bg-card p-6 md:col-span-2">
          <p className="mb-4 text-sm font-medium">Account details</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{user?.name || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium">Owner</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
