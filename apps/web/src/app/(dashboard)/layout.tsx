import { AppSidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { BottomNav, MobileNavSheet } from "@/components/layout/mobile-nav"
import { MobileNavProvider } from "@/components/layout/mobile-nav-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
            {children}
          </main>
        </div>
        <MobileNavSheet />
        <BottomNav />
      </div>
    </MobileNavProvider>
  )
}
