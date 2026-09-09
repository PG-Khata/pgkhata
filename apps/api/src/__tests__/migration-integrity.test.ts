import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateMigrationArtifacts } from "../../../../packages/db/src/migration-integrity";

function fixture(options: { includeSql?: boolean; includeSnapshot?: boolean; prevId?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "pgkhata-migrations-"));
  mkdirSync(join(root, "meta"));
  writeFileSync(join(root, "meta", "_journal.json"), JSON.stringify({ entries: [{ idx: 0, tag: "0000_init" }] }));
  if (options.includeSql !== false) writeFileSync(join(root, "0000_init.sql"), "select 1;");
  if (options.includeSnapshot !== false) {
    writeFileSync(join(root, "meta", "0000_snapshot.json"), JSON.stringify({
      id: "11111111-1111-1111-1111-111111111111",
      prevId: options.prevId ?? "00000000-0000-0000-0000-000000000000",
    }));
  }
  return root;
}

describe("migration artifact integrity", () => {
  it("accepts a complete journal, SQL file, and snapshot chain", () => {
    expect(validateMigrationArtifacts(fixture())).toEqual([]);
  });

  it("rejects missing SQL, missing snapshots, and broken snapshot ancestry", () => {
    expect(validateMigrationArtifacts(fixture({ includeSql: false }))).toContainEqual(
      expect.stringContaining("no SQL file"),
    );
    expect(validateMigrationArtifacts(fixture({ includeSnapshot: false }))).toContainEqual(
      expect.stringContaining("Missing snapshot"),
    );
    expect(validateMigrationArtifacts(fixture({ prevId: "wrong" }))).toContainEqual(
      expect.stringContaining("prevId"),
    );
  });

  it("reuses the existing production access-token index during reconciliation", () => {
    const sql = readFileSync(
      new URL("../../../../packages/db/reconciliation/production-14-to-22.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toMatch(
      /add constraint bill_access_token_unique\s+unique using index bill_access_token_unique/i,
    );
    expect(sql).not.toMatch(
      /add constraint bill_access_token_unique\s+unique\s*\(\s*access_token\s*\)/i,
    );
  });

  it("orders migration 0025 preflight and supporting indexes before constraints", () => {
    const sql = readFileSync(
      new URL("../../../../packages/db/drizzle/0025_secret_gauntlet.sql", import.meta.url),
      "utf8",
    );
    const preflight = sql.indexOf("Cross-property or active-occupancy violations");
    const parentIndex = sql.indexOf('CREATE UNIQUE INDEX "floor_id_property_uq"');
    const compositeForeignKey = sql.indexOf('ADD CONSTRAINT "room_floor_property_fk"');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(parentIndex).toBeGreaterThan(preflight);
    expect(compositeForeignKey).toBeGreaterThan(parentIndex);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.set_updated_at()");
    expect(sql).toContain("CREATE TRIGGER set_updated_at BEFORE UPDATE");
  });
});
