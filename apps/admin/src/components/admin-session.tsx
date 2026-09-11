"use client";

import { createContext, useContext } from "react";

export type PlatformAdminRole = "super_admin" | "support";

export interface AdminSession {
  id: string;
  userId: string;
  role: PlatformAdminRole;
  name: string;
  email: string;
}

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({
  admin,
  children,
}: {
  admin: AdminSession;
  children: React.ReactNode;
}) {
  return <AdminSessionContext.Provider value={admin}>{children}</AdminSessionContext.Provider>;
}

/**
 * The admin identity the server-side layout gate already verified. Hiding nav
 * behind this is cosmetic only — every privileged route is enforced by
 * `requireAdmin("super_admin")` on the API.
 */
export function useAdminSession(): AdminSession {
  const admin = useContext(AdminSessionContext);
  if (!admin) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return admin;
}

export const ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: "Super Admin",
  support: "Support",
};
