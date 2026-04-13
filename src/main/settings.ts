import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  defaultSettings,
  normalizeStoredSettings,
  type AppSettings
} from "../shared/settings";
import type { ProviderId } from "../shared/providers";
import { Logger } from "./logger";

const SESSION_ARTIFACTS = [
  "Cookies",
  "Local Storage",
  "Session Storage",
  "IndexedDB",
  "Network"
];
const PROVIDER_PARTITION_STORAGE_PATHS: Record<ProviderId, string> = {
  x: path.join("Partitions", "vibedock", "provider", "x", "browser", "default"),
  tiktok: path.join("Partitions", "vibedock", "provider", "tiktok", "browser", "default"),
  instagram: path.join("Partitions", "vibedock", "provider", "instagram", "browser", "default")
};

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
    const next = normalizeStoredSettings(this.mergePatch(this.settings, patch));

    this.settings = next;
    this.persist();
    return next;
  }

  saveWindowBounds(bounds: AppSettings["windowBounds"]): void {
    this.settings = normalizeStoredSettings({
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
      return normalizeStoredSettings(JSON.parse(raw), {
        hasPersistedXSessionArtifacts: this.resolveBootstrapCompletion("x")
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

  private mergePatch(current: AppSettings, patch: Partial<AppSettings>): Record<string, unknown> {
    const activeProviderId = patch.activeProviderId ?? current.activeProviderId;
    const providerTabs = {
      x: {
        ...current.providerTabs.x
      },
      tiktok: {
        ...current.providerTabs.tiktok
      },
      instagram: {
        ...current.providerTabs.instagram
      }
    };

    if (patch.providerTabs?.x) {
      providerTabs.x = {
        ...providerTabs.x,
        ...patch.providerTabs.x
      };
    }

    if (patch.providerTabs?.tiktok) {
      providerTabs.tiktok = {
        ...providerTabs.tiktok,
        ...patch.providerTabs.tiktok
      };
    }

    if (patch.providerTabs?.instagram) {
      providerTabs.instagram = {
        ...providerTabs.instagram,
        ...patch.providerTabs.instagram
      };
    }

    return {
      ...current,
      ...patch,
      version: 2,
      activeProviderId,
      providerTabs
    };
  }

  private resolveBootstrapCompletion(providerId: ProviderId): boolean {
    const partitionPath = path.join(
      app.getPath("userData"),
      PROVIDER_PARTITION_STORAGE_PATHS[providerId]
    );
    const hasPersistedSessionArtifacts = SESSION_ARTIFACTS.some((entry) => {
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
      this.logger.info("Detected persisted provider session artifacts; defaulting to mobile web mode", {
        providerId
      });
    }

    return hasPersistedSessionArtifacts;
  }
}
