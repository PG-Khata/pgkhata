import { resolve } from "node:path";
import { assertMigrationArtifacts } from "../src/migration-integrity";

const migrationsFolder = resolve(process.cwd(), "drizzle");
assertMigrationArtifacts(migrationsFolder);
console.log("Migration journal, SQL files, and snapshot chain are consistent.");
