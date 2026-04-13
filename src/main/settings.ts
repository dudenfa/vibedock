import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { appSettingsSchema, defaultSettings, type AppSettings } from "../shared/settings";
import { Logger } from "./logger";

const X_PARTITION_STORAGE_PATH = path.join(
  "Partitions",
  "vibedock",
  "provider",
  "x",
  "browser",
  "default"
);
const X_SESSION_ARTIFACTS = [
  "Cookies",
  "Local Storage",
  "Session Storage",
  "IndexedDB",
  "Network"
];

export class SettingsService {
  private readonly filePath: string;
  private settings: AppSettings;

  constructor(private readonly logger: Logger) {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
    this.settings = this.load();
  }

  get(): AppSettings {
    return this.settings;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const next = appSettingsSchema.parse({
      ...this.settings,
      ...patch,
      version: 1
    });

    this.settings = next;
    this.persist();
    return next;
  }

  saveWindowBounds(bounds: AppSettings["windowBounds"]): void {
    this.settings = appSettingsSchema.parse({
      ...this.settings,
      windowBounds: bounds
    });
    this.persist();
  }

  private load(): AppSettings {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.persistDefault();
        return defaultSettings;
      }

      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsedRaw = JSON.parse(raw) as Partial<AppSettings> & Record<string, unknown>;
      return appSettingsSchema.parse({
        ...defaultSettings,
        xBootstrapCompleted: this.resolveBootstrapCompletion(parsedRaw),
        ...parsedRaw
      });
    } catch (error) {
      this.logger.warn("Falling back to default settings", {
        error: error instanceof Error ? error.message : "unknown"
      });
      this.persistDefault();
      return defaultSettings;
    }
  }

  private persistDefault(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(defaultSettings, null, 2)}\n`, "utf8");
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.settings, null, 2)}\n`, "utf8");
  }

  private resolveBootstrapCompletion(raw: Partial<AppSettings> & Record<string, unknown>): boolean {
    if (typeof raw.xBootstrapCompleted === "boolean") {
      return raw.xBootstrapCompleted;
    }

    const partitionPath = path.join(app.getPath("userData"), X_PARTITION_STORAGE_PATH);
    const hasPersistedSessionArtifacts = X_SESSION_ARTIFACTS.some((entry) => {
      const artifactPath = path.join(partitionPath, entry);
      try {
        if (!fs.existsSync(artifactPath)) {
          return false;
        }

        const stat = fs.statSync(artifactPath);
        return stat.isDirectory() || stat.size > 0;
      } catch {
        return false;
      }
    });

    if (hasPersistedSessionArtifacts) {
      this.logger.info("Detected persisted X session artifacts; defaulting to mobile web mode");
    }

    return hasPersistedSessionArtifacts;
  }
}
