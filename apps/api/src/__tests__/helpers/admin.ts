import request from "supertest";
import type { Express } from "express";
import type { Response as SupertestResponse } from "supertest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  account,
  adminAuditLog,
  impersonationSession,
  ownerProfile,
  platformAdmin,
  session,
  user,
  type PlatformAdminRole,
} from "@pgkhata/db";
import { registerVerifiedUser } from "../db-auth-helper";
import { IMPERSONATION_COOKIE } from "../../lib/impersonation";

/**
 * Fixtures for the DB-backed platform-admin and impersonation suites.
 *
 * Everything here goes through the real HTTP surface where one exists — a
 * support session that is minted by hand proves nothing about the endpoint that
 * mints it in production. The only direct database writes are the ones with no
 * endpoint at all (granting platform-admin, aging a timestamp, deactivating an
 * admin out of band), and those are exactly the preconditions the tests need.
 */

export interface TestAdmin {
  /** better-auth user id */
  userId: string;
  /** platform_admin.id */
  adminId: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
  /** better-auth session cookie for this admin's own login */
  cookie: string[];
}

export interface TestOwner {
  userId: string;
  /** owner_profile.id — the value impersonation targets */
  ownerId: string;
  email: string;
  name: string;
  cookie: string[];
}

const PASSWORD = "integration-password-123";

/** Registers a verified user and grants them platform-admin with `role`. */
export async function createPlatformAdmin(
  app: Express,
  options: { label: string; role: PlatformAdminRole; isActive?: boolean },
): Promise<TestAdmin> {
  const email = `${options.label}@pgkhata.test`;
  const name = `Admin ${options.label}`;
  const { userId, cookie } = await registerVerifiedUser(app, { name, email, password: PASSWORD });

  // There is no bootstrap endpoint for the first admin, and `POST /v1/admin/admins`
  // needs a super_admin to already exist, so the grant itself is a direct insert.
  const [admin] = await db
    .insert(platformAdmin)
    .values({ userId, role: options.role, isActive: options.isActive ?? true })
    .returning({ id: platformAdmin.id });
  if (!admin) throw new Error("Failed to create platform admin fixture");

  return { userId, adminId: admin.id, email, name, role: options.role, cookie };
}

/**
 * Registers a verified user and returns their owner profile, which better-auth
 * provisions on sign-up. Falls back to creating one so a change to that hook
 * surfaces as a clear failure here rather than a confusing 403 later.
 */
export async function createTestOwner(
  app: Express,
  options: { label: string },
): Promise<TestOwner> {
  const email = `${options.label}@pgkhata.test`;
  const name = `Owner ${options.label}`;
  const { userId, cookie } = await registerVerifiedUser(app, { name, email, password: PASSWORD });

  let [profile] = await db
    .select({ id: ownerProfile.id })
    .from(ownerProfile)
    .where(eq(ownerProfile.userId, userId))
    .limit(1);

  if (!profile) {
    [profile] = await db
      .insert(ownerProfile)
      .values({ userId })
      .returning({ id: ownerProfile.id });
  }
  if (!profile) throw new Error("Failed to resolve owner profile fixture");

  return { userId, ownerId: profile.id, email, name, cookie };
}

/** Registers a verified user with no platform-admin row at all. */
export async function createPlainUser(app: Express, label: string) {
  const email = `${label}@pgkhata.test`;
  return registerVerifiedUser(app, { name: `User ${label}`, email, password: PASSWORD });
}

// ──────────────────────────────────────────────
// Support sessions
// ──────────────────────────────────────────────

export function startImpersonation(
  app: Express,
  admin: TestAdmin,
  ownerId: string,
  reason: string,
) {
  return request(app)
    .post(`/v1/admin/owners/${ownerId}/impersonate`)
    .set("Cookie", admin.cookie)
    .send({ reason });
}

export function claimHandoff(app: Express, token: string) {
  return request(app).post("/v1/impersonation/claim").send({ token });
}

/** `.../impersonate/start?token=<handoff>` -> `<handoff>` */
export function handoffTokenFrom(redirectUrl: unknown): string {
  const match = /[?&]token=([^&]+)/.exec(String(redirectUrl));
  if (!match?.[1]) throw new Error(`No handoff token in redirectUrl: ${String(redirectUrl)}`);
  return decodeURIComponent(match[1]);
}

/** The `pgk_imp` cookie, as a header value ready for `.set("Cookie", ...)`. */
export function grantCookieFrom(res: SupertestResponse): string[] {
  const setCookie = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  const raw = setCookie.find((c) => c.startsWith(`${IMPERSONATION_COOKIE}=`));
  if (!raw) throw new Error("claim did not set the impersonation cookie");
  return [raw.split(";")[0]!];
}

/** True when a response tells the browser to drop the grant cookie. */
export function clearsGrantCookie(res: SupertestResponse): boolean {
  const setCookie = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  return setCookie.some((c) => /^pgk_imp=(;|$)/.test(c));
}

export interface Grant {
  sessionId: string;
  handoffToken: string;
  /** Bearer of this cookie alone is the impersonated caller. */
  cookie: string[];
}

/** Start + claim: the full production path from admin console to owner app. */
export async function openGrant(
  app: Express,
  admin: TestAdmin,
  ownerId: string,
  reason: string,
): Promise<Grant> {
  const started = await startImpersonation(app, admin, ownerId, reason);
  if (started.status !== 201) {
    throw new Error(`impersonate failed: ${started.status} ${JSON.stringify(started.body)}`);
  }
  const handoffToken = handoffTokenFrom(started.body.redirectUrl);

  const claimed = await claimHandoff(app, handoffToken);
  if (claimed.status !== 200) {
    throw new Error(`claim failed: ${claimed.status} ${JSON.stringify(claimed.body)}`);
  }

  return { sessionId: started.body.sessionId, handoffToken, cookie: grantCookieFrom(claimed) };
}

/**
 * Ages the write window into the past.
 *
 * The window lapses by timestamp comparison on every request, so this is the
 * honest way to test it: fake timers would move the process clock but not
 * `now()` inside Postgres, and the two disagree is precisely the bug class this
 * design avoids.
 */
export async function lapseWriteWindow(sessionId: string): Promise<void> {
  await db
    .update(impersonationSession)
    // Left non-null to satisfy impersonation_session_write_window_check.
    .set({ writeExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(impersonationSession.id, sessionId));
}

/** Ages the one-time handoff so claiming it is too late. */
export async function expireHandoff(sessionId: string): Promise<void> {
  await db
    .update(impersonationSession)
    .set({ handoffExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(impersonationSession.id, sessionId));
}

export async function setAdminActive(adminId: string, isActive: boolean): Promise<void> {
  await db.update(platformAdmin).set({ isActive }).where(eq(platformAdmin.id, adminId));
}

export async function readSession(sessionId: string) {
  const [row] = await db
    .select()
    .from(impersonationSession)
    .where(eq(impersonationSession.id, sessionId))
    .limit(1);
  return row;
}

export async function auditRowsForSession(sessionId: string) {
  return db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.impersonationSessionId, sessionId));
}

/**
 * The audit write on an ordinary privileged request is deliberately not awaited
 * by the response interceptor, so the row lands shortly after the response.
 * Polls rather than sleeping a fixed amount.
 */
export async function waitForAuditRows<T>(
  read: () => Promise<T[]>,
  done: (rows: T[]) => boolean,
  timeoutMs = 15_000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  let rows = await read();
  while (!done(rows) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    rows = await read();
  }
  return rows;
}

/**
 * Drizzle wraps driver errors in a DrizzleQueryError whose own message is only
 * "Failed query: ...", so the text a trigger raised lives further down the
 * `cause` chain. Flattens the chain so a test can match on it.
 *
 * `helpers/pg-error.ts` handles constraint violations, which carry a SQLSTATE
 * and a constraint name; a `RAISE EXCEPTION` from a trigger carries neither.
 */
export function driverErrorMessage(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as { message?: string; cause?: unknown };
    if (typeof candidate.message === "string") messages.push(candidate.message);
    current = candidate.cause;
  }
  return messages.join(" | ");
}

/** Resolves to the flattened rejection message, or null if the query succeeded. */
export function rejectionMessage(operation: Promise<unknown>): Promise<string | null> {
  return operation.then(
    () => null,
    (error: unknown) => driverErrorMessage(error),
  );
}

// ──────────────────────────────────────────────
// Teardown
// ──────────────────────────────────────────────

/**
 * admin_audit_log carries a BEFORE UPDATE OR DELETE trigger that raises, so the
 * rows a test produces cannot be removed — and neither can the platform_admin
 * and impersonation_session rows they point at, because both foreign keys are
 * ON DELETE SET NULL and that SET NULL is itself an UPDATE.
 *
 * Dropping the trigger for the length of a teardown is the documented escape
 * hatch (the migration says retention deletes must do exactly this). It is
 * deliberate, narrow, and always re-enabled — including when the delete throws.
 */
export async function withAuditTriggerDisabled<T>(fn: () => Promise<T>): Promise<T> {
  await db.execute(
    sql`alter table admin_audit_log disable trigger admin_audit_log_append_only`,
  );
  try {
    return await fn();
  } finally {
    await db.execute(
      sql`alter table admin_audit_log enable trigger admin_audit_log_append_only`,
    );
  }
}

/** Removes every row the admin/impersonation fixtures above can create. */
export async function teardownAdmins(admins: TestAdmin[]): Promise<void> {
  if (admins.length === 0) return;
  const adminUserIds = admins.map((a) => a.userId);
  const adminIds = admins.map((a) => a.adminId);

  await withAuditTriggerDisabled(async () => {
    await db.delete(adminAuditLog).where(inArray(adminAuditLog.adminUserId, adminUserIds));
  });

  await db.delete(impersonationSession).where(inArray(impersonationSession.adminId, adminIds));
  await db.delete(platformAdmin).where(inArray(platformAdmin.userId, adminUserIds));
  await db.delete(session).where(inArray(session.userId, adminUserIds));
  await db.delete(account).where(inArray(account.userId, adminUserIds));
  await db.delete(ownerProfile).where(inArray(ownerProfile.userId, adminUserIds));
  await db.delete(user).where(inArray(user.id, adminUserIds));
}

/**
 * Owner-side teardown. Property/tenant rows are the caller's to remove first;
 * this clears what the owner fixture itself created.
 */
export async function teardownOwners(owners: { userId: string; ownerId: string }[]): Promise<void> {
  if (owners.length === 0) return;
  const userIds = owners.map((o) => o.userId);
  const ownerIds = owners.map((o) => o.ownerId);

  await withAuditTriggerDisabled(async () => {
    await db.delete(adminAuditLog).where(inArray(adminAuditLog.ownerId, ownerIds));
  });

  await db
    .delete(impersonationSession)
    .where(inArray(impersonationSession.targetOwnerId, ownerIds));
  await db.delete(session).where(inArray(session.userId, userIds));
  await db.delete(account).where(inArray(account.userId, userIds));
  await db.delete(ownerProfile).where(inArray(ownerProfile.id, ownerIds));
  await db.delete(user).where(inArray(user.id, userIds));
}
