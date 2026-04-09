import fs from "node:fs";
import path from "node:path";
import { Logger } from "./logger";

const CACHE_DIRECTORY_NAMES = new Set([
  "Cache",
  "Code Cache",
  "GPUCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache"
]);

export function cleanupChromiumCaches(userDataPath: string, logger: Logger): void {
  const removedPaths: string[] = [];

  for (const directoryName of CACHE_DIRECTORY_NAMES) {
    removeDirectory(path.join(userDataPath, directoryName), removedPaths);
  }

  removeDirectory(path.join(userDataPath, "Shared Dictionary", "cache"), removedPaths);
  walkForPartitionCaches(path.join(userDataPath, "Partitions"), removedPaths);

  if (removedPaths.length > 0) {
    logger.info("Cleared Chromium cache directories", {
      removedPaths
    });
  }
}

function walkForPartitionCaches(rootPath: string, removedPaths: string[]): void {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(rootPath, entry.name);

    if (CACHE_DIRECTORY_NAMES.has(entry.name)) {
      removeDirectory(entryPath, removedPaths);
      continue;
    }

    if (entry.name === "Shared Dictionary") {
      removeDirectory(path.join(entryPath, "cache"), removedPaths);
    }

    walkForPartitionCaches(entryPath, removedPaths);
  }
}

function removeDirectory(targetPath: string, removedPaths: string[]): void {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  removedPaths.push(targetPath);
}
