import { PropertyRedirect } from "@/components/layout/property-redirect"

// Payments is now a global, dropdown-scoped page. Keep this route redirecting so
// old links and bookmarks still land in the right place.
export default function LegacyPropertyPaymentsPage() {
  return <PropertyRedirect to="/dashboard/payments" />
}
