"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { useImpersonationStatus, useExitImpersonation } from "@/hooks/use-impersonation";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { data: impersonation } = useImpersonationStatus();
  const exitImpersonation = useExitImpersonation();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  function handleExitImpersonation() {
    exitImpersonation.mutate(undefined, {
      onSuccess: () => {
        router.refresh();
      },
    });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-56 border-r bg-sidebar md:block">
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-14 w-full" />
          <div className="p-6">
            <Skeleton className="h-8 w-48" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <AdminHeader />
        {impersonation?.impersonating && impersonation.ownerName && (
          <ImpersonationBanner ownerName={impersonation.ownerName} onExit={handleExitImpersonation} />
        )}
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
