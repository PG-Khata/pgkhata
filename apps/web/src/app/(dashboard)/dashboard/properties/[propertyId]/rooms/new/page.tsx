import { PropertyRedirect } from "@/components/layout/property-redirect"

// Room creation is now the global, dropdown-scoped /dashboard/structure/new.
// Keep this route redirecting for old links.
export default function LegacyNewRoomPage() {
  return <PropertyRedirect to="/dashboard/structure/new" />
}
