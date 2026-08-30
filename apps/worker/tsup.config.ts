import { defineConfig } from "tsup";

/** Same rationale as apps/api: workspace packages export raw TypeScript. */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@pgkhata\//],
});
