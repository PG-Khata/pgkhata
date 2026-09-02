"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Bill, Payment } from "@/types"

interface TenantFinancialReport {
  tenant: { id: string; name: string; phone: string; status: string }
  summary: { totalBilled: number; totalPaid: number; totalBalance: number }
  bills: Bill[]
  payments: Payment[]
}

interface CheckoutPreview {
  outstandingBills: number
  securityDepositHeld: number
  securityDepositRefunded: number
  advanceAvailable: number
  advanceApplied: number
  netPayable: number
  refundDue: number
}

export function useTenantFinancialReport(propertyId: string, tenantId: string) {
  return useQuery({
    queryKey: ["tenant-financial-report", propertyId, tenantId],
    queryFn: () =>
      api.get<TenantFinancialReport>(
        `/v1/properties/${propertyId}/tenants/${tenantId}/financial-report`,
      ),
    enabled: !!propertyId && !!tenantId,
  })
}

export function useTenantCheckoutPreview(propertyId: string, tenantId: string) {
  return useQuery({
    queryKey: ["tenant-checkout-preview", propertyId, tenantId],
    queryFn: () =>
      api.get<CheckoutPreview>(
        `/v1/properties/${propertyId}/tenants/${tenantId}/checkout-preview`,
      ),
    enabled: !!propertyId && !!tenantId,
  })
}
