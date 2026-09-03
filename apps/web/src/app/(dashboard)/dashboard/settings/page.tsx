"use client"

import Link from "next/link"
import { useSelectedProperty } from "@/components/layout/property-context"
import { useProperties } from "@/hooks/use-properties"
import {
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  Layers,
  Receipt,
  Settings,
  Shield,
  Tags,
  Users,
  Zap,
} from "lucide-react"

interface SettingCard {
  title: string
  description: string
  icon: React.ElementType
  href: string
}

const SETTINGS_CARDS: SettingCard[] = [
  {
    title: "Rent Plans",
    description: "Base rent, deposit, due day, and late fee configuration.",
    icon: Receipt,
    href: "/dashboard/rent-plans",
  },
  {
    title: "Charge Types",
    description: "Configure billable charges beyond rent — Electricity, Mess, and more.",
    icon: Tags,
    href: "/dashboard/charge-types",
  },
  {
    title: "Billing Policy",
    description: "How advance payments get applied, and booking hold duration.",
    icon: CreditCard,
    href: "/dashboard/billing",
  },
  {
    title: "Notification Preferences",
    description: "Choose In-App, WhatsApp, or Email per event type.",
    icon: Bell,
    href: "/dashboard/notifications",
  },
  {
    title: "Structure",
    description: "Manage floors, rooms, and bed layout for your properties.",
    icon: Layers,
    href: "/dashboard/structure",
  },
  {
    title: "Properties",
    description: "Add, edit, or configure your PG properties.",
    icon: Building2,
    href: "/dashboard/properties",
  },
  {
    title: "Staff",
    description: "Create employee accounts and manage access.",
    icon: Users,
    href: "/dashboard/bookings",
  },
  {
    title: "Meter Reading",
    description: "Configure electricity rates and manage meter readings.",
    icon: Zap,
    href: "/dashboard/readings",
  },
  {
    title: "Documents",
    description: "Manage property-level documents and agreements.",
    icon: FileText,
    href: "/dashboard/properties",
  },
  {
    title: "Security",
    description: "Change your account password and security settings.",
    icon: Shield,
    href: "/dashboard/profile",
  },
]

export default function SettingsPage() {
  const { selectedProperty } = useSelectedProperty()
  const { data: properties } = useProperties()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure everything for your properties and account.
        </p>
      </div>

      {selectedProperty && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2.5">
          <p className="text-sm">
            <span className="text-muted-foreground">Active property: </span>
            <span className="font-medium">{selectedProperty.name}</span>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{card.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Click to explore →
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
