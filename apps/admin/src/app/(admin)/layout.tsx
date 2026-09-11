import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import type { AdminSession } from "@/components/admin-session";

const API_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * The real gate. This runs on the server before any admin markup is produced,
 * so a non-admin never receives the shell, the nav, or the page bundles — the
 * previous client-side `useSession()` check only proved *a* session existed and
 * let any registered owner render the whole console.
 *
 * better-auth validates sessions inside the Express API, not here, so the only
 * honest check Next can make is to forward the cookie and ask.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) redirect("/login");

  let admin: AdminSession | null = null;
  try {
    const res = await fetch(new URL("/v1/admin/me", API_URL), {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) admin = (await res.json()) as AdminSession;
  } catch {
    // API unreachable — fail closed rather than rendering an unguarded console.
    admin = null;
  }

  if (!admin) redirect("/login");

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
