import { AppSidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { BottomNav, MobileNavSheet } from "@/components/layout/mobile-nav"
import { MobileNavProvider } from "@/components/layout/mobile-nav-context"
import { PropertyProvider } from "@/components/layout/property-context"
import { PropertyPageContent } from "@/components/layout/property-page-content"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <PropertyProvider>
        <div className="flex min-h-screen overflow-x-hidden">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto bg-muted/30 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
              <div className="mx-auto max-w-5xl">
                <PropertyPageContent>{children}</PropertyPageContent>
              </div>
            </main>
          </div>
          <MobileNavSheet />
          <BottomNav />
        </div>
      </PropertyProvider>
    </MobileNavProvider>
  )
}
