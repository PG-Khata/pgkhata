/**
 * Every platform-admin login lives on one domain, so the console takes an alias
 * and appends this. Change the constant here if the platform domain ever moves.
 */
export const ADMIN_EMAIL_DOMAIN = "pgkhata.com";

/** "teammate" -> "teammate@pgkhata.com". A value that already has an "@" is
 * left as-is, so a full email still works where one is typed. */
export function toAdminEmail(input: string): string {
  const value = input.trim();
  if (!value) return "";
  return value.includes("@") ? value : `${value}@${ADMIN_EMAIL_DOMAIN}`;
}

/** The alias portion of an email, for display. */
export function aliasOf(email: string): string {
  return email.includes("@") ? (email.split("@")[0] ?? email) : email;
}

/** An alias is the local part only: no "@", no whitespace, non-empty. */
export function isValidAlias(alias: string): boolean {
  const value = alias.trim();
  return value.length > 0 && !/[@\s]/.test(value);
}
