"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useAdminOwnerDetails(ownerId: string) {
  return useQuery({
    queryKey: ["admin", "owners", ownerId, "details"],
    queryFn: () =>
      api.get<
        AdminOwner & {
          tenants: Array<{ id: string; name: string; phone: string; status: string; propertyName: string }>;
          billingSummary: {
            totalBilled: number;
            totalCollected: number;
            totalPending: number;
            totalBills: number;
          };
        }
      >(`/v1/admin/owners/${ownerId}/details`),
    enabled: !!ownerId,
  });
}

export function useAdminPropertyDetails(propertyId: string) {
  return useQuery({
    queryKey: ["admin", "properties", propertyId, "details"],
    queryFn: () =>
      api.get<{
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        ownerName: string | null;
        floors: Array<{ id: string; name: string; position: number }>;
        rooms: Array<{ id: string; number: string; floorId: string | null; capacity: number }>;
        beds: Array<{
          bed: { id: string; number: string; status: string; monthlyRent: number | null };
          roomNumber: string;
        }>;
        tenants: Array<{
          id: string;
          name: string;
          phone: string;
          status: string;
          roomNumber: string | null;
          bedNumber: string | null;
        }>;
      }>(`/v1/admin/properties/${propertyId}/details`),
    enabled: !!propertyId,
  });
}

export function useAdminTenantDetails(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "details"],
    queryFn: () =>
      api.get<
        AdminTenant & {
          bills: AdminBill[];
          payments: AdminPayment[];
          roomNumber: string | null;
          bedNumber: string | null;
        }
      >(`/v1/admin/tenants/${tenantId}/details`),
    enabled: !!tenantId,
  });
}

import type { AdminOwner, AdminBill, AdminPayment, AdminTenant } from "@/types";
