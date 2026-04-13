import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupChromiumCaches } from "../../src/main/cache-maintenance";

class TestLogger {
  info(): void {}
  warn(): void {}
  error(): void {}
}

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("cleanupChromiumCaches", () => {
  it("removes cache directories but keeps session files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibedock-cache-"));
    tempRoots.push(root);

    fs.mkdirSync(path.join(root, "Cache", "Cache_Data"), { recursive: true });
    fs.mkdirSync(path.join(root, "Shared Dictionary", "cache"), { recursive: true });
    fs.mkdirSync(path.join(root, "Partitions", "vibedock", "provider", "x", "browser", "default", "Cache"), {
      recursive: true
    });
    fs.writeFileSync(path.join(root, "Cookies"), "cookie-db", "utf8");
    fs.writeFileSync(
      path.join(root, "Partitions", "vibedock", "provider", "x", "browser", "default", "Cookies"),
      "partition-cookie-db",
      "utf8"
    );

    cleanupChromiumCaches(root, new TestLogger() as never);

    expect(fs.existsSync(path.join(root, "Cache"))).toBe(false);
    expect(fs.existsSync(path.join(root, "Shared Dictionary"))).toBe(false);
    expect(
      fs.existsSync(path.join(root, "Partitions", "vibedock", "provider", "x", "browser", "default", "Cache"))
    ).toBe(false);
    expect(fs.readFileSync(path.join(root, "Cookies"), "utf8")).toBe("cookie-db");
    expect(
      fs.readFileSync(
        path.join(root, "Partitions", "vibedock", "provider", "x", "browser", "default", "Cookies"),
        "utf8"
      )
    ).toBe("partition-cookie-db");
  });
});
