import { defineConfig } from "tsup";

/**
 * Workspace packages (@pgkhata/db, /auth, /email, ...) export raw TypeScript
 * via `"exports": "./src/index.ts"`, which plain `tsc` output cannot resolve at
 * runtime — node would be asked to import a .ts file. Bundling inlines them so
 * the Dockerfile's `node dist/server.js` actually runs.
 *
 * Because those packages are inlined, apps/api must declare their runtime npm
 * dependencies itself (better-auth, pg, postgres, resend). tsup externalises
 * anything listed in `dependencies`; leaving better-auth undeclared caused it
 * to be bundled and to resolve the API's zod 3 instead of the zod 4 it needs,
 * which failed at boot with "sessionSchema.loose is not a function".
 */
export default defineConfig({
  entry: ["src/server.ts", "src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Inline workspace packages, keep real npm dependencies external.
  noExternal: [/^@pgkhata\//],
});
