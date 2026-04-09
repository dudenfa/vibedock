import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "main/index": "src/main/index.ts",
    "preload/index": "src/preload/index.ts"
  },
  outDir: "dist-electron",
  format: ["cjs"],
  external: ["electron"],
  sourcemap: true,
  clean: false,
  target: "node20"
});
