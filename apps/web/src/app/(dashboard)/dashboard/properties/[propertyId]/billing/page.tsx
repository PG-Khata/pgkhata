import { PropertyRedirect } from "@/components/layout/property-redirect"

// Billing is now a global, dropdown-scoped page. Keep this route redirecting so
// old links and bookmarks still land in the right place.
export default function LegacyPropertyBillingPage() {
  return <PropertyRedirect to="/dashboard/billing" />
}
