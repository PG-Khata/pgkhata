import { PropertyRedirect } from "@/components/layout/property-redirect"

// The structure (floors/rooms/beds) view is now the global, dropdown-scoped
// /dashboard/structure. Keep this route redirecting for old links.
export default function LegacyPropertyRoomsPage() {
  return <PropertyRedirect to="/dashboard/structure" />
}
