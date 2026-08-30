"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { SubscriptionPlan } from "@/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { Check } from "lucide-react"

export default function SettingsPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<SubscriptionPlan[]>("/v1/subscriptions/plans"),
  })

  const { data: currentSub } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<{ plan: SubscriptionPlan; status: string }>("/v1/subscriptions/current"),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Subscription
        </p>
        <div className="border-b" />
      </div>

      {currentSub && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Current plan:</span>
          <span className="text-sm font-medium">{currentSub.plan.name}</span>
          <span className="text-xs text-muted-foreground">
            ({currentSub.plan.price === 0 ? "Free" : `${formatCurrency(currentSub.plan.price)}/mo`})
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : plans ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentSub?.plan.id === plan.id
            return (
              <div
                key={plan.id}
                className={`rounded-md border p-4 ${
                  isCurrent ? "border-foreground" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-xs font-medium text-muted-foreground">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {plan.price === 0 ? "Free" : `${formatCurrency(plan.price)}/mo`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to {plan.maxProperties} properties, {plan.maxRooms} rooms
                </p>
                <ul className="mt-3 space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3 w-3" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && plan.price > 0 && (
                  <Button size="sm" className="mt-4 w-full">
                    Upgrade
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
