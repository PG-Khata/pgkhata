"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, LogOut, Menu, Shield } from "lucide-react";
import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSearchPalette } from "@/components/admin-search-palette";
import { useState } from "react";
import { ROLE_LABELS, useAdminSession } from "@/components/admin-session";
import { useImpersonationSessions, useEndAllImpersonations } from "@/hooks/use-impersonation";
import { toast } from "sonner";

export function AdminHeader() {
  const router = useRouter();
  const admin = useAdminSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: sessions } = useImpersonationSessions();
  const endAll = useEndAllImpersonations();

  // A session left open on another tab or device is still live access to an
  // owner's data, so it needs a kill switch that is always on screen.
  const live = (sessions ?? []).filter(
    (s) => s.endedAt === null && s.adminUserId === admin.userId,
  );

  function handleEndAll() {
    endAll.mutate(undefined, {
      onSuccess: (result) => toast.success(`Ended ${result.ended} support session(s)`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to end sessions"),
    });
  }

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <Shield className="h-4 w-4" />
            <span>{ROLE_LABELS[admin.role]}</span>
          </div>
          {/* Support agents live in this box; it stays on screen everywhere. */}
          <AdminSearchPalette />
        </div>
        <div className="flex items-center gap-3">
          {live.length > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
              <Eye className="h-3.5 w-3.5" />
              <span>
                {live.length} active support session{live.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={handleEndAll}
                disabled={endAll.isPending}
                className="font-medium underline underline-offset-2 disabled:opacity-50"
              >
                End
              </button>
            </div>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">{admin.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>
      <AdminMobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
