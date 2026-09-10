"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Shield } from "lucide-react";
import { AdminMobileNav } from "./admin-mobile-nav";
import { useState } from "react";

export function AdminHeader() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Platform Admin</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Logout
        </Button>
      </header>
      <AdminMobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
