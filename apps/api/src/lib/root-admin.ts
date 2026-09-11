/**
 * Root (protected) platform admins.
 *
 * No one — not even another active super_admin — can change a root admin's
 * role, deactivate them, or remove them from the console. This is defined in
 * code, not in the database, on purpose: the protection cannot be lifted from
 * the admin UI or by a stray SQL update, so changing who is root takes a
 * deliberate deploy.
 *
 * Overridable via ROOT_ADMIN_EMAILS (comma-separated) for other environments.
 */
const DEFAULT_ROOT_ADMINS = "mukund@pgkhata.com";

export const ROOT_ADMIN_EMAILS = new Set(
  (process.env.ROOT_ADMIN_EMAILS ?? DEFAULT_ROOT_ADMINS)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isRootAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ROOT_ADMIN_EMAILS.has(email!.toLowerCase());
}
