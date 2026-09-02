"use client"

import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Moon,
  Sun,
  User,
  Bell,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MobileNavTrigger } from "./mobile-nav"
import { useSelectedProperty } from "./property-context"
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from "@/hooks/use-notifications"

export function Header() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { selectedProperty, setSelectedProperty, properties } = useSelectedProperty()
  const { data: unreadData } = useUnreadCount(selectedProperty?.id)
  const { data: notifications } = useNotifications(selectedProperty?.id)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const unreadCount = unreadData?.count ?? 0
  const recentNotifications = (notifications ?? []).slice(0, 5)

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex items-center gap-3">
        <MobileNavTrigger />
        <span className="text-base font-semibold tracking-tight text-foreground md:hidden">
          pgkhata
        </span>

        {properties.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[160px] truncate">
                {selectedProperty?.name ?? "All properties"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Your properties</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSelectedProperty(null)}
                className={!selectedProperty ? "bg-accent" : ""}
              >
                {!selectedProperty && <Check className="mr-2 h-4 w-4" />}
                <span className={!selectedProperty ? "" : "ml-6"}>
                  All properties
                </span>
              </DropdownMenuItem>
              {properties.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedProperty(p)}
                  className={p.id === selectedProperty?.id ? "bg-accent" : ""}
                >
                  {p.id === selectedProperty?.id && (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  <span className={p.id === selectedProperty?.id ? "" : "ml-6"}>
                    {p.name}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-sm font-medium">Notifications</p>
              {unreadCount > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => markAllAsRead.mutate(selectedProperty?.id)}
                >
                  Mark all read
                </button>
              )}
            </div>
            {recentNotifications.length > 0 ? (
              <>
                {recentNotifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
                    onClick={() => {
                      if (!n.read) markAsRead.mutate(n.id)
                      if (n.link) router.push(n.link)
                    }}
                  >
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-blue-500" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.read ? "font-medium" : "text-muted-foreground"}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <div className="border-t px-3 py-2">
                  <button
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => router.push("/dashboard/notifications")}
                  >
                    View all notifications
                  </button>
                </div>
              </>
            ) : (
              <div className="px-3 py-6 text-center">
                <Bell className="mx-auto h-6 w-6 text-muted-foreground/30" />
                <p className="mt-1.5 text-xs text-muted-foreground">No notifications yet</p>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                MJ
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">Mukund Jha</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
