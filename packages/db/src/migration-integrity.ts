import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

interface Snapshot {
  id: string;
  prevId: string;
}

export function validateMigrationArtifacts(migrationsFolder: string): string[] {
  const errors: string[] = [];
  const metaFolder = join(migrationsFolder, "meta");
  const journalPath = join(metaFolder, "_journal.json");
  if (!existsSync(journalPath)) return ["Missing migration journal"];

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const sqlFiles = new Set(
    readdirSync(migrationsFolder).filter((name) => /^\d{4}_.+\.sql$/.test(name)),
  );
  const expectedSql = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));

  for (const file of expectedSql) {
    if (!sqlFiles.has(file)) errors.push(`Journal entry has no SQL file: ${file}`);
  }
  for (const file of sqlFiles) {
    if (!expectedSql.has(file)) errors.push(`SQL file is absent from journal: ${file}`);
  }

  let previousId = "00000000-0000-0000-0000-000000000000";
  for (const entry of journal.entries) {
    const snapshotPath = join(metaFolder, `${String(entry.idx).padStart(4, "0")}_snapshot.json`);
    if (!existsSync(snapshotPath)) {
      errors.push(`Missing snapshot for journal index ${entry.idx}: ${snapshotPath}`);
      continue;
    }
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
    if (snapshot.prevId !== previousId) {
      errors.push(`Snapshot ${entry.idx} prevId does not match the preceding snapshot`);
    }
    previousId = snapshot.id;
  }

  return errors;
}

export function assertMigrationArtifacts(migrationsFolder: string): void {
  const errors = validateMigrationArtifacts(migrationsFolder);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
