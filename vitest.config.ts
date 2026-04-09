import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/contracts/**/*.spec.ts", "tests/unit/**/*.spec.ts"]
  }
});
