"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAdminSession } from "@/components/admin-session";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Owners", href: "/dashboard/owners", icon: Users },
  { label: "Properties", href: "/dashboard/properties", icon: Building2 },
  { label: "Tenants", href: "/dashboard/tenants", icon: Users },
  { label: "Billing", href: "/dashboard/billing", icon: Receipt },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { label: "Blog", href: "/dashboard/blog", icon: FileText },
  { label: "Support Sessions", href: "/dashboard/support-sessions", icon: UserCog },
  { label: "Audit Log", href: "/dashboard/audit", icon: ScrollText, superAdminOnly: true },
  { label: "Admins", href: "/dashboard/admins", icon: ShieldCheck, superAdminOnly: true },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminMobileNav({ open, onOpenChange }: Props) {
  const pathname = usePathname();
  const admin = useAdminSession();
  const items = NAV_ITEMS.filter((item) => !item.superAdminOnly || admin.role === "super_admin");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base font-semibold">
            PGKhata <span className="text-muted-foreground font-normal">Admin</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 py-4">
          <div className="space-y-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
