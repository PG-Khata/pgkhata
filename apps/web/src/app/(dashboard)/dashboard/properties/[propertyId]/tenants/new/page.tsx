import { PropertyRedirect } from "@/components/layout/property-redirect"

// Tenant onboarding now happens from the global Tenants page (onboard modal).
// This legacy route redirects there — it also used to link to a scoped tenant
// list that no longer exists (404).
export default function LegacyPropertyNewTenantPage() {
  return <PropertyRedirect to="/dashboard/tenants" />
}
