"use client"

import { authClient, useSession } from "@/lib/auth-client"
import { signOut } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  KeyRound,
  Pencil,
  Save,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const searchParams = useSearchParams()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState("")
  const [savingName, setSavingName] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" })
  const passwordOpen = searchParams.get("change-password") === "1"

  useEffect(() => {
    setName(session?.user.name ?? "")
  }, [session?.user.name])

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  async function handleSaveName() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Enter your name")
      return
    }

    setSavingName(true)
    const { error } = await authClient.updateUser({ name: trimmedName })
    setSavingName(false)

    if (error) {
      toast.error(error.message || "Could not update your name")
      return
    }

    toast.success("Profile updated")
    setEditingName(false)
  }

  async function handleChangePassword() {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      toast.error("Complete all password fields")
      return
    }
    if (passwords.next.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords do not match")
      return
    }

    setChangingPassword(true)
    const { error } = await authClient.changePassword({
      currentPassword: passwords.current,
      newPassword: passwords.next,
      revokeOtherSessions: true,
    })
    setChangingPassword(false)

    if (error) {
      toast.error(error.message || "Could not change password")
      return
    }

    toast.success("Password changed. Other sessions have been signed out.")
    setPasswords({ current: "", next: "", confirm: "" })
    router.replace("/dashboard/profile")
  }

  function setPasswordDialog(open: boolean) {
    if (open) return
    setPasswords({ current: "", next: "", confirm: "" })
    router.replace("/dashboard/profile")
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
              className="mt-4"
              onClick={() => router.push("/dashboard/profile?change-password=1")}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Change password
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border bg-card p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">Account details</p>
            {!editingName && (
              <Button variant="outline" size="sm" onClick={() => setEditingName(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit name
              </Button>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                {editingName ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-8 w-56"
                      aria-label="Name"
                    />
                    <Button size="sm" className="h-8" onClick={handleSaveName} disabled={savingName}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {savingName ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setName(user?.name ?? "")
                        setEditingName(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium">{user?.name || "-"}</p>
                )}
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

      <Dialog open={passwordOpen} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Use a strong password. Changing it signs out your other active sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Current password</label>
              <Input type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New password</label>
              <Input type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirm new password</label>
              <Input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} onKeyDown={(event) => event.key === "Enter" && handleChangePassword()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPasswordDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
