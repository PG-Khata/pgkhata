"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminAnalytics } from "@/types";

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => api.get<AdminAnalytics>("/v1/admin/analytics"),
  });
}
