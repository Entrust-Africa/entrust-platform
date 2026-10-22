import { defineConfig } from "tsdown";

// Bundle the workspace packages into one file; keep npm dependencies external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  outDir: "dist",
  noExternal: [/^@entrust\//],
});
