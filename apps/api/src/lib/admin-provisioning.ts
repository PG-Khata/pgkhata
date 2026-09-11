import { randomBytes } from "node:crypto";
import { db, user, account, ownerProfile, platformAdmin } from "@pgkhata/db";
import { and, eq } from "drizzle-orm";
import { auth } from "@pgkhata/auth";

/**
 * Provisioning for console-created platform admins.
 *
 * Two hard constraints shape this, both learned the hard way:
 *
 *  1. An admin is NOT an owner. Every normal sign-up runs
 *     `ensureOwnerProfile` in Better Auth's create hook, so we delete the
 *     owner_profile that hook makes rather than trying to suppress it.
 *
 *  2. Only a credential that Better Auth itself created is accepted at
 *     sign-in — a hand-inserted `account` row is found by `findUserByEmail`
 *     but rejected by the sign-in path. So the credential is minted by
 *     `signUpEmail` with a throwaway password, which is then nulled so the
 *     throwaway cannot be used, and the person's real password is set on first
 *     login via `updatePassword` (which updates that same Better-Auth-made row).
 */

interface CredentialAdapter {
  updatePassword(userId: string, hashedPassword: string): Promise<unknown>;
}

export async function findUserByEmail(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return row ?? null;
}

/**
 * A login with a credential but no usable password yet. `emailVerified` is true
 * because the super admin who added them is the vouching authority — there is
 * no inbox round-trip to gate an internal teammate on.
 */
export async function createPasswordlessUser(email: string, name: string) {
  const throwaway = randomBytes(24).toString("base64url");
  const res = await auth.api.signUpEmail({
    body: { email, password: throwaway, name },
    asResponse: true,
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Failed to create admin login (${res.status}): ${detail}`);
  }

  const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!row) throw new Error("User row missing after sign-up");

  await db.update(user).set({ emailVerified: true }).where(eq(user.id, row.id));
  // An admin is not an owner — drop the profile the sign-up hook created.
  await db.delete(ownerProfile).where(eq(ownerProfile.userId, row.id));
  // Null the throwaway so the account cannot be used until its owner sets a
  // password on first login.
  await db
    .update(account)
    .set({ password: null })
    .where(and(eq(account.userId, row.id), eq(account.providerId, "credential")));

  return { ...row, emailVerified: true };
}

/** A usable email/password credential exists for this user. */
export async function userHasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  return Boolean(row?.password);
}

/**
 * Set the first password. Updates the Better-Auth-created credential in place
 * (its `updatePassword` matches on the very fields sign-in checks), so the
 * account signs in exactly as a normal one would.
 */
export async function setInitialPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  await (ctx.internalAdapter as unknown as CredentialAdapter).updatePassword(userId, hash);
}

/** The active platform-admin row for a user, if any. */
export async function activePlatformAdmin(userId: string) {
  const [row] = await db
    .select({ id: platformAdmin.id, isActive: platformAdmin.isActive })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, userId))
    .limit(1);
  if (!row || !row.isActive) return null;
  return row;
}

/** "teammate@pgkhata.com" -> "Teammate". A sensible display name until edited. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || email;
}
