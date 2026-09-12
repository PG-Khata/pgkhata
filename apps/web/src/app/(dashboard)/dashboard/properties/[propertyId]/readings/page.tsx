import { PropertyRedirect } from "@/components/layout/property-redirect"

// Meter readings are now a global, dropdown-scoped page. Keep this route
// redirecting so old links and bookmarks still land in the right place.
export default function LegacyPropertyReadingsPage() {
  return <PropertyRedirect to="/dashboard/readings" />
}
