import { ownerProfile } from "@pgkhata/db";

/**
 * Minimal structural type for the insert chain this module needs, so the
 * provisioning logic can be unit-tested with a fake database.
 */
export interface OwnerProfileWriter {
  insert: (table: typeof ownerProfile) => {
    values: (row: { userId: string }) => {
      onConflictDoNothing: (config: { target: unknown }) => {
        returning: () => Promise<Array<{ id: string; userId: string }>>;
      };
    };
  };
}

export interface EnsureOwnerProfileResult {
  /** The owner profile id, whether it was just created or already existed. */
  ownerId: string | undefined;
  created: boolean;
}

/**
 * Every owner-scoped route sits behind `requireOwner`, which resolves the
 * caller's `owner_profile` row. Without this provisioning step a freshly
 * registered owner receives 403 "Owner profile not found" from every product
 * endpoint, which is exactly the state this repo was in.
 *
 * Relies on the `owner_profile_user_id_unique` constraint rather than a
 * read-then-write check, so concurrent sign-up retries cannot create two
 * profiles for one user.
 */
export async function ensureOwnerProfile(
  database: OwnerProfileWriter,
  userId: string,
): Promise<EnsureOwnerProfileResult> {
  const inserted = await database
    .insert(ownerProfile)
    .values({ userId })
    .onConflictDoNothing({ target: ownerProfile.userId })
    .returning();

  const row = inserted[0];
  return { ownerId: row?.id, created: Boolean(row) };
}
