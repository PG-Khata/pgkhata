"use client";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import { AdminSessionProvider, type AdminSession } from "@/components/admin-session";

/**
 * The chrome around every admin page. Deliberately holds no auth logic — the
 * `(admin)/layout.tsx` server component has already proven platform-admin
 * status against the API before this renders.
 */
export function AdminShell({
  admin,
  children,
}: {
  admin: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider admin={admin}>
      <div className="flex min-h-screen overflow-x-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminSessionProvider>
  );
}
