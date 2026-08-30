import { describe, it, expect, vi } from "vitest";
import { ensureOwnerProfile, type OwnerProfileWriter } from "@pgkhata/auth";
import { ownerProfile } from "@pgkhata/db";

/**
 * Fake database that records the insert chain and returns `rows` from
 * `.returning()`. An empty array is what Drizzle yields when
 * `onConflictDoNothing` suppressed the insert.
 */
function fakeDb(rows: Array<{ id: string; userId: string }>) {
  const calls = {
    table: undefined as unknown,
    values: undefined as unknown,
    conflictTarget: undefined as unknown,
  };

  const database: OwnerProfileWriter = {
    insert: (table) => {
      calls.table = table;
      return {
        values: (row) => {
          calls.values = row;
          return {
            onConflictDoNothing: (config) => {
              calls.conflictTarget = config.target;
              return { returning: async () => rows };
            },
          };
        },
      };
    },
  };

  return { database, calls };
}

describe("ensureOwnerProfile", () => {
  it("creates a profile for a new user and reports it as created", async () => {
    const { database, calls } = fakeDb([{ id: "owner-1", userId: "user-1" }]);

    const result = await ensureOwnerProfile(database, "user-1");

    expect(result).toEqual({ ownerId: "owner-1", created: true });
    expect(calls.table).toBe(ownerProfile);
    expect(calls.values).toEqual({ userId: "user-1" });
  });

  it("targets the user_id unique constraint so a retry cannot duplicate", async () => {
    const { database, calls } = fakeDb([{ id: "owner-1", userId: "user-1" }]);

    await ensureOwnerProfile(database, "user-1");

    // Race safety comes from the database constraint, not an application read.
    expect(calls.conflictTarget).toBe(ownerProfile.userId);
  });

  it("is idempotent: a second call for the same user creates nothing", async () => {
    const { database } = fakeDb([]);

    const result = await ensureOwnerProfile(database, "user-1");

    expect(result.created).toBe(false);
    expect(result.ownerId).toBeUndefined();
  });

  it("does not swallow database failures", async () => {
    const database = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              throw new Error("connection terminated");
            },
          }),
        }),
      }),
    } as unknown as OwnerProfileWriter;

    await expect(ensureOwnerProfile(database, "user-1")).rejects.toThrow(
      "connection terminated",
    );
  });

  it("provisions exactly one profile per user across concurrent calls", async () => {
    // Two concurrent sign-up completions: the constraint lets one insert win.
    const returning = vi
      .fn()
      .mockResolvedValueOnce([{ id: "owner-1", userId: "user-1" }])
      .mockResolvedValueOnce([]);

    const database = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({ returning }),
        }),
      }),
    } as unknown as OwnerProfileWriter;

    const results = await Promise.all([
      ensureOwnerProfile(database, "user-1"),
      ensureOwnerProfile(database, "user-1"),
    ]);

    expect(results.filter((r) => r.created)).toHaveLength(1);
  });
});
